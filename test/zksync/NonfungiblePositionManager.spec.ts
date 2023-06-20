import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'
// import { Fixture } from 'ethereum-waffle'
// import { BigNumberish, constants, Wallet } from 'ethers'
import { BigNumberish, constants, utils } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { Provider, Wallet } from 'zksync-web3'
import {
  IUniswapV3Factory,
  IWETH9,
  MockTimeNonfungiblePositionManager,
  NonfungiblePositionManagerPositionsGasTest,
  SwapRouter,
  TestERC20,
  TestPositionNFTOwner,
} from '../../typechain'
import completeFixture from './shared/completeFixture'
import { computePoolAddress } from './shared/computePoolAddress'
import { FeeAmount, MaxUint128, PRIVATE_KEY, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { expect } from './shared/expect'
import { extractJSONFromURI } from './shared/extractJSONFromURI'
import getContractInstance from './shared/getContractInstance'
import getPermitNFTSignature from './shared/getPermitNFTSignature'
import { encodePath } from './shared/path'
import poolAtAddress from './shared/poolAtAddress'
import snapshotGasCost from './shared/snapshotGasCost'
import { getMaxTick, getMinTick } from './shared/ticks'
import { sortedTokens } from './shared/tokenSort'

describe('NonfungiblePositionManager', () => {
  let wallets: Wallet[]
  let wallet: Wallet, other: Wallet

  // const nftFixture: Fixture<{
  //   nft: MockTimeNonfungiblePositionManager
  //   factory: IUniswapV3Factory
  //   tokens: [TestERC20, TestERC20, TestERC20]
  //   weth9: IWETH9
  //   router: SwapRouter
  // }> = async (wallets, provider) => {
    const nftFixture = async (wallets: Wallet[], provider: Provider) => {
    const { weth9, factory, tokens, nft, router } = await completeFixture(wallets, provider)

    // approve & fund wallets
    for (const token of tokens) {
      let tx
      tx = await token.approve(nft.address, constants.MaxUint256)
      await tx.wait()
      tx = await token.connect(other).approve(nft.address, constants.MaxUint256)
      await tx.wait()
      tx = await token.transfer(other.address, expandTo18Decimals(1_000_000))
      await tx.wait()
    }

    return {
      nft,
      factory,
      tokens,
      weth9,
      router,
    }
  }

  let factory: IUniswapV3Factory
  let nft: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]
  let weth9: IWETH9
  let router: SwapRouter

  // let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    // wallets = await (ethers as any).getSigners()
    // ;[wallet, other] = wallets
    const provider = Provider.getDefaultProvider()
    wallet = new Wallet(PRIVATE_KEY, provider)
    other = Wallet.createRandom().connect(provider)
    const tx = await wallet.transfer({ to: other.address, amount: utils.parseEther("1") })
    await tx.wait()
    wallets = [wallet, other]

    // loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    // ;({ nft, factory, tokens, weth9, router } = await loadFixture(nftFixture))
    const fixture = await nftFixture(wallets, Provider.getDefaultProvider())
    factory = fixture.factory
    nft = fixture.nft
    tokens = fixture.tokens
    weth9 = fixture.weth9
    router = fixture.router
  })

  it('bytecode size', async () => {
    expect(((await nft.provider.getCode(nft.address)).length - 2) / 2).to.matchSnapshot()
  })

  describe('#createAndInitializePoolIfNecessary', () => {
    it('creates the pool at the expected address', async () => {
      const expectedAddress = await computePoolAddress(
        factory,
        [tokens[0].address, tokens[1].address],
        FeeAmount.MEDIUM
        )
      // get deterministic address work differently in zkevm
      // const code = await wallet.provider.getCode(expectedAddress)
      // expect(code).to.eq('0x')
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      const codeAfter = await wallet.provider.getCode(expectedAddress)
      expect(codeAfter).to.not.eq('0x')
    })

    it('is payable', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1),
        { value: 1 }
      )
    })

    it('works if pool is created but not initialized', async () => {
      const expectedAddress = await computePoolAddress(
        factory,
        [tokens[0].address, tokens[1].address],
        FeeAmount.MEDIUM
      )
      await factory.createPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)
      const code = await wallet.provider.getCode(expectedAddress)
      expect(code).to.not.eq('0x')
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(2, 1)
      )
    })

    it('works if pool is created and initialized', async () => {
      const expectedAddress = await computePoolAddress(
        factory,
        [tokens[0].address, tokens[1].address],
        FeeAmount.MEDIUM
      )
      await factory.createPool(tokens[0].address, tokens[1].address, FeeAmount.MEDIUM)
      const pool = new ethers.Contract(expectedAddress, IUniswapV3PoolABI, wallet)

      await pool.initialize(encodePriceSqrt(3, 1))
      const code = await wallet.provider.getCode(expectedAddress)
      expect(code).to.not.eq('0x')
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(4, 1)
      )
    })

    it('could theoretically use eth via multicall', async () => {
      const [token0, token1] = sortedTokens(weth9, tokens[0])

      const createAndInitializePoolIfNecessaryData = nft.interface.encodeFunctionData(
        'createAndInitializePoolIfNecessary',
        [token0.address, token1.address, FeeAmount.MEDIUM, encodePriceSqrt(1, 1)]
      )

      await nft.multicall([createAndInitializePoolIfNecessaryData], { value: expandTo18Decimals(1) })
    })

    it('gas', async () => {
      await snapshotGasCost(
        nft.createAndInitializePoolIfNecessary(
          tokens[0].address,
          tokens[1].address,
          FeeAmount.MEDIUM,
          encodePriceSqrt(1, 1)
        )
      )
    })
  })

  describe('#mint', () => {
    it('fails if pool does not exist', async () => {
      await expect(
        nft.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallet.address,
          deadline: 1,
          fee: FeeAmount.MEDIUM,
        })
      ).to.be.reverted
    })

    it('fails if cannot transfer', async () => {
      let tx
      tx = await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()
      tx = await tokens[0].approve(nft.address, 0)
      await tx.wait()
      await expect(
        nft.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallet.address,
          deadline: 1,
        })
      ).to.be.revertedWith('STF')
    })

    it('creates a token', async () => {
      let tx
      tx = await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: other.address,
        amount0Desired: 15,
        amount1Desired: 15,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })
      await tx.wait()
      expect(await nft.balanceOf(other.address)).to.eq(1)
      expect(await nft.tokenOfOwnerByIndex(other.address, 0)).to.eq(1)
      const {
        fee,
        token0,
        token1,
        tickLower,
        tickUpper,
        liquidity,
        tokensOwed0,
        tokensOwed1,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
      } = await nft.positions(1)
      expect(token0).to.eq(tokens[0].address)
      expect(token1).to.eq(tokens[1].address)
      expect(fee).to.eq(FeeAmount.MEDIUM)
      expect(tickLower).to.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(tickUpper).to.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(liquidity).to.eq(15)
      expect(tokensOwed0).to.eq(0)
      expect(tokensOwed1).to.eq(0)
      expect(feeGrowthInside0LastX128).to.eq(0)
      expect(feeGrowthInside1LastX128).to.eq(0)
    })

    it('can use eth via multicall', async () => {
      let tx
      const [token0, token1] = sortedTokens(weth9, tokens[0])

      // remove any approval
      tx = await weth9.approve(nft.address, 0)
      await tx.wait()

      const createAndInitializeData = nft.interface.encodeFunctionData('createAndInitializePoolIfNecessary', [
        token0.address,
        token1.address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1),
      ])

      const mintData = nft.interface.encodeFunctionData('mint', [
        {
          token0: token0.address,
          token1: token1.address,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          fee: FeeAmount.MEDIUM,
          recipient: other.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        },
      ])

      const refundETHData = nft.interface.encodeFunctionData('refundETH')

      const balanceBefore = await wallet.getBalance()
      tx = await nft.multicall([createAndInitializeData, mintData, refundETHData], {
        value: expandTo18Decimals(1),
      })
      const receipt = await tx.wait()
      const balanceAfter = await wallet.getBalance()
      expect(balanceBefore).to.eq(balanceAfter.add(receipt.gasUsed.mul(tx.gasPrice!)).add(100))
    })

    it('emits an event')

    it('gas first mint for pool', async () => {
      let tx
      tx = await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      await snapshotGasCost(
        nft.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          fee: FeeAmount.MEDIUM,
          recipient: wallet.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10,
        })
      )
    })

    it('gas first mint for pool using eth with zero refund', async () => {
      let tx
      const [token0, token1] = sortedTokens(weth9, tokens[0])
      tx = await nft.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      await snapshotGasCost(
        nft.multicall(
          [
            nft.interface.encodeFunctionData('mint', [
              {
                token0: token0.address,
                token1: token1.address,
                tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
                tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
                fee: FeeAmount.MEDIUM,
                recipient: wallet.address,
                amount0Desired: 100,
                amount1Desired: 100,
                amount0Min: 0,
                amount1Min: 0,
                deadline: 10,
              },
            ]),
            nft.interface.encodeFunctionData('refundETH'),
          ],
          { value: 100 }
        )
      )
    })

    it('gas first mint for pool using eth with non-zero refund', async () => {
      let tx
      const [token0, token1] = sortedTokens(weth9, tokens[0])
      tx = await nft.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      await snapshotGasCost(
        nft.multicall(
          [
            nft.interface.encodeFunctionData('mint', [
              {
                token0: token0.address,
                token1: token1.address,
                tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
                tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
                fee: FeeAmount.MEDIUM,
                recipient: wallet.address,
                amount0Desired: 100,
                amount1Desired: 100,
                amount0Min: 0,
                amount1Min: 0,
                deadline: 10,
              },
            ]),
            nft.interface.encodeFunctionData('refundETH'),
          ],
          { value: 1000 }
        )
      )
    })

    it('gas mint on same ticks', async () => {
      let tx
      tx = await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: other.address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })
      await tx.wait()

      await snapshotGasCost(
        nft.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          fee: FeeAmount.MEDIUM,
          recipient: wallet.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10,
        })
      )
    })

    it('gas mint for same pool, different ticks', async () => {
      let tx
      tx = await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: other.address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })
      await tx.wait()

      await snapshotGasCost(
        nft.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]) + TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]) - TICK_SPACINGS[FeeAmount.MEDIUM],
          fee: FeeAmount.MEDIUM,
          recipient: wallet.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10,
        })
      )
    })
  })

  describe('#increaseLiquidity', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      let tx
      tx = await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: other.address,
        amount0Desired: 1000,
        amount1Desired: 1000,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      })
      await tx.wait()
    })

    it('increases position liquidity', async () => {
      let tx
      tx = await nft.increaseLiquidity({
        tokenId: tokenId,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      })
      await tx.wait()
      const { liquidity } = await nft.positions(tokenId)
      expect(liquidity).to.eq(1100)
    })

    it('emits an event')

    it('can be paid with ETH', async () => {
      let tx
      const [token0, token1] = sortedTokens(tokens[0], weth9)

      const tokenId = 1

      tx = await nft.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      const mintData = nft.interface.encodeFunctionData('mint', [
        {
          token0: token0.address,
          token1: token1.address,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: other.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        },
      ])
      const refundETHData = nft.interface.encodeFunctionData('unwrapWETH9', [0, other.address])
      tx = await nft.multicall([mintData, refundETHData], { value: expandTo18Decimals(1) })
      await tx.wait()

      const increaseLiquidityData = nft.interface.encodeFunctionData('increaseLiquidity', [
        {
          tokenId: tokenId,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        },
      ])
      tx = await nft.multicall([increaseLiquidityData, refundETHData], { value: expandTo18Decimals(1) })
      await tx.wait()
    })

    it('gas', async () => {
      await snapshotGasCost(
        nft.increaseLiquidity({
          tokenId: tokenId,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        })
      )
    })
  })

  describe('#decreaseLiquidity', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      let tx
      tx = await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: other.address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      })
      await tx.wait()
    })

    it('emits an event')

    it('fails if past deadline', async () => {
      const tx = await nft.setTime(2)
      await tx.wait()
      await expect(
        nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 })
      ).to.be.revertedWith('Transaction too old')
    })

    it('cannot be called by other addresses', async () => {
      await expect(
        nft.decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 })
      ).to.be.revertedWith('Not approved')
    })

    it('decreases position liquidity', async () => {
      const tx = await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 25, amount0Min: 0, amount1Min: 0, deadline: 1 })
      await tx.wait()
      const { liquidity } = await nft.positions(tokenId)
      expect(liquidity).to.eq(75)
    })

    it('is payable', async () => {
      const tx = await nft
        .connect(other)
        .decreaseLiquidity({ tokenId, liquidity: 25, amount0Min: 0, amount1Min: 0, deadline: 1 }, { value: 1 })
      await tx.wait()
    })

    it('accounts for tokens owed', async () => {
      const tx = await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 25, amount0Min: 0, amount1Min: 0, deadline: 1 })
      await tx.wait()
      const { tokensOwed0, tokensOwed1 } = await nft.positions(tokenId)
      expect(tokensOwed0).to.eq(24)
      expect(tokensOwed1).to.eq(24)
    })

    it('can decrease for all the liquidity', async () => {
      const tx = await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 100, amount0Min: 0, amount1Min: 0, deadline: 1 })
      await tx.wait()
      const { liquidity } = await nft.positions(tokenId)
      expect(liquidity).to.eq(0)
    })

    it('cannot decrease for more than all the liquidity', async () => {
      await expect(
        nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 101, amount0Min: 0, amount1Min: 0, deadline: 1 })
      ).to.be.reverted
    })

    it('cannot decrease for more than the liquidity of the nft position', async () => {
      const tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: other.address,
        amount0Desired: 200,
        amount1Desired: 200,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      })
      await tx.wait()
      await expect(
        nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 101, amount0Min: 0, amount1Min: 0, deadline: 1 })
      ).to.be.reverted
    })

    it('gas partial decrease', async () => {
      await snapshotGasCost(
        nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 })
      )
    })

    it('gas complete decrease', async () => {
      await snapshotGasCost(
        nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 100, amount0Min: 0, amount1Min: 0, deadline: 1 })
      )
    })
  })

  describe('#collect', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      let tx
      tx = await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      })
      await tx.wait()
    })

    it('emits an event')

    it('cannot be called by other addresses', async () => {
      await expect(
        nft.collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        })
      ).to.be.revertedWith('Not approved')
    })

    it('cannot be called with 0 for both amounts', async () => {
      await expect(
        nft.connect(other).collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: 0,
          amount1Max: 0,
        })
      ).to.be.reverted
    })

    it('no op if no tokens are owed', async () => {
      await expect(
        nft.connect(other).collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        })
      )
        .to.not.emit(tokens[0], 'Transfer')
        .to.not.emit(tokens[1], 'Transfer')
    })

    it('transfers tokens owed from burn', async () => {
      const tx = await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 })
      await tx.wait()
      const poolAddress = await computePoolAddress(factory, [tokens[0].address, tokens[1].address], FeeAmount.MEDIUM)
      await expect(
        nft.connect(other).collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        })
      )
        .to.emit(tokens[0], 'Transfer')
        .withArgs(poolAddress, wallet.address, 49)
        .to.emit(tokens[1], 'Transfer')
        .withArgs(poolAddress, wallet.address, 49)
    })

    it('gas transfers both', async () => {
      const tx = await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 })
      await tx.wait()
      await snapshotGasCost(
        nft.connect(other).collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        })
      )
    })

    it('gas transfers token0 only', async () => {
      const tx = await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 })
      await tx.wait()
      await snapshotGasCost(
        nft.connect(other).collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: 0,
        })
      )
    })

    it('gas transfers token1 only', async () => {
      const tx = await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 })
      await tx.wait()
      await snapshotGasCost(
        nft.connect(other).collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: 0,
          amount1Max: MaxUint128,
        })
      )
    })
  })

  describe('#burn', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      let tx
      tx = await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      })
      await tx.wait()
    })

    it('emits an event')

    it('cannot be called by other addresses', async () => {
      await expect(nft.burn(tokenId)).to.be.revertedWith('Not approved')
    })

    it('cannot be called while there is still liquidity', async () => {
      await expect(nft.connect(other).burn(tokenId)).to.be.revertedWith('Not cleared')
    })

    it('cannot be called while there is still partial liquidity', async () => {
      await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 })
      await expect(nft.connect(other).burn(tokenId)).to.be.revertedWith('Not cleared')
    })

    it('cannot be called while there is still tokens owed', async () => {
      const tx = await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 100, amount0Min: 0, amount1Min: 0, deadline: 1 })
      await tx.wait()
      await expect(nft.connect(other).burn(tokenId)).to.be.revertedWith('Not cleared')
    })

    it('deletes the token', async () => {
      let tx
      tx = await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 100, amount0Min: 0, amount1Min: 0, deadline: 1 })
      await tx.wait()
      tx = await nft.connect(other).collect({
        tokenId,
        recipient: wallet.address,
        amount0Max: MaxUint128,
        amount1Max: MaxUint128,
      })
      await tx.wait()
      tx = await nft.connect(other).burn(tokenId)
      await tx.wait()
      await expect(nft.positions(tokenId)).to.be.revertedWith('Invalid token ID')
    })

    it('gas', async () => {
      let tx
      tx = await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 100, amount0Min: 0, amount1Min: 0, deadline: 1 })
      await tx.wait()
      tx = await nft.connect(other).collect({
        tokenId,
        recipient: wallet.address,
        amount0Max: MaxUint128,
        amount1Max: MaxUint128,
      })
      await tx.wait()
      await snapshotGasCost(nft.connect(other).burn(tokenId))
    })
  })

  describe('#transferFrom', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      let tx
      tx = await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      })
      await tx.wait()
    })

    it('can only be called by authorized or owner', async () => {
      await expect(nft.transferFrom(other.address, wallet.address, tokenId)).to.be.revertedWith(
        'ERC721: transfer caller is not owner nor approved'
      )
    })

    it('changes the owner', async () => {
      const tx = await nft.connect(other).transferFrom(other.address, wallet.address, tokenId)
      await tx.wait()
      expect(await nft.ownerOf(tokenId)).to.eq(wallet.address)
    })

    it('removes existing approval', async () => {
      let tx
      tx = await nft.connect(other).approve(wallet.address, tokenId)
      await tx.wait()
      expect(await nft.getApproved(tokenId)).to.eq(wallet.address)
      tx = await nft.transferFrom(other.address, wallet.address, tokenId)
      await tx.wait()
      expect(await nft.getApproved(tokenId)).to.eq(constants.AddressZero)
    })

    it('gas', async () => {
      await snapshotGasCost(nft.connect(other).transferFrom(other.address, wallet.address, tokenId))
    })

    it('gas comes from approved', async () => {
      const tx = await nft.connect(other).approve(wallet.address, tokenId)
      await tx.wait()
      await snapshotGasCost(nft.transferFrom(other.address, wallet.address, tokenId))
    })
  })

  describe('#permit', () => {
    it('emits an event')

    describe('owned by eoa', () => {
      const tokenId = 1
      beforeEach('create a position', async () => {
        let tx
        tx = await nft.createAndInitializePoolIfNecessary(
          tokens[0].address,
          tokens[1].address,
          FeeAmount.MEDIUM,
          encodePriceSqrt(1, 1)
        )
        await tx.wait()

        tx = await nft.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: other.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        })
        await tx.wait()
      })

      it('changes the operator of the position and increments the nonce', async () => {
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1)
        const tx = await nft.permit(wallet.address, tokenId, 1, v, r, s)
        await tx.wait()
        expect((await nft.positions(tokenId)).nonce).to.eq(1)
        expect((await nft.positions(tokenId)).operator).to.eq(wallet.address)
      })

      it('cannot be called twice with the same signature', async () => {
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1)
        const tx = await nft.permit(wallet.address, tokenId, 1, v, r, s)
        await tx.wait()
        await expect(nft.permit(wallet.address, tokenId, 1, v, r, s)).to.be.reverted
      })

      it('fails with invalid signature', async () => {
        const { v, r, s } = await getPermitNFTSignature(wallet, nft, wallet.address, tokenId, 1)
        await expect(nft.permit(wallet.address, tokenId, 1, v + 3, r, s)).to.be.revertedWith('Invalid signature')
      })

      it('fails with signature not from owner', async () => {
        const { v, r, s } = await getPermitNFTSignature(wallet, nft, wallet.address, tokenId, 1)
        await expect(nft.permit(wallet.address, tokenId, 1, v, r, s)).to.be.revertedWith('Unauthorized')
      })

      it('fails with expired signature', async () => {
        const tx = await nft.setTime(2)
        await tx.wait()
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1)
        await expect(nft.permit(wallet.address, tokenId, 1, v, r, s)).to.be.revertedWith('Permit expired')
      })

      it('gas', async () => {
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1)
        await snapshotGasCost(nft.permit(wallet.address, tokenId, 1, v, r, s))
      })
    })
    describe('owned by verifying contract', () => {
      const tokenId = 1
      let testPositionNFTOwner: TestPositionNFTOwner

      beforeEach('deploy test owner and create a position', async () => {
        let tx
        // testPositionNFTOwner = (await (
        //   await ethers.getContractFactory('TestPositionNFTOwner')
        // ).deploy()) as TestPositionNFTOwner
        testPositionNFTOwner = await getContractInstance("TestPositionNFTOwner") as TestPositionNFTOwner

        tx = await nft.createAndInitializePoolIfNecessary(
          tokens[0].address,
          tokens[1].address,
          FeeAmount.MEDIUM,
          encodePriceSqrt(1, 1)
        )
        await tx.wait()

        tx = await nft.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: testPositionNFTOwner.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        })
        await tx.wait()
      })

      it('changes the operator of the position and increments the nonce', async () => {
        let tx
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1)
        tx = await testPositionNFTOwner.setOwner(other.address)
        await tx.wait()
        tx = await nft.permit(wallet.address, tokenId, 1, v, r, s)
        await tx.wait()
        expect((await nft.positions(tokenId)).nonce).to.eq(1)
        expect((await nft.positions(tokenId)).operator).to.eq(wallet.address)
      })

      it('fails if owner contract is owned by different address', async () => {
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1)
        const tx = await testPositionNFTOwner.setOwner(wallet.address)
        await tx.wait()
        await expect(nft.permit(wallet.address, tokenId, 1, v, r, s)).to.be.revertedWith('Unauthorized')
      })

      it('fails with signature not from owner', async () => {
        const { v, r, s } = await getPermitNFTSignature(wallet, nft, wallet.address, tokenId, 1)
        const tx = await testPositionNFTOwner.setOwner(other.address)
        await tx.wait()
        await expect(nft.permit(wallet.address, tokenId, 1, v, r, s)).to.be.revertedWith('Unauthorized')
      })

      it('fails with expired signature', async () => {
        await nft.setTime(2)
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1)
        const tx = await testPositionNFTOwner.setOwner(other.address)
        await tx.wait()
        await expect(nft.permit(wallet.address, tokenId, 1, v, r, s)).to.be.revertedWith('Permit expired')
      })

      it('gas', async () => {
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1)
        const tx = await testPositionNFTOwner.setOwner(other.address)
        await tx.wait()
        await snapshotGasCost(nft.permit(wallet.address, tokenId, 1, v, r, s))
      })
    })
  })

  describe('multicall exit', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      let tx
      tx = await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      })
      await tx.wait()
    })

    async function exit({
      nft,
      liquidity,
      tokenId,
      amount0Min,
      amount1Min,
      recipient,
    }: {
      nft: MockTimeNonfungiblePositionManager
      tokenId: BigNumberish
      liquidity: BigNumberish
      amount0Min: BigNumberish
      amount1Min: BigNumberish
      recipient: string
    }) {
      const decreaseLiquidityData = nft.interface.encodeFunctionData('decreaseLiquidity', [
        { tokenId, liquidity, amount0Min, amount1Min, deadline: 1 },
      ])
      const collectData = nft.interface.encodeFunctionData('collect', [
        {
          tokenId,
          recipient,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        },
      ])
      const burnData = nft.interface.encodeFunctionData('burn', [tokenId])

      return await nft.multicall([decreaseLiquidityData, collectData, burnData])
    }

    it('executes all the actions', async () => {
      const pool = poolAtAddress(
        await computePoolAddress(factory, [tokens[0].address, tokens[1].address], FeeAmount.MEDIUM),
        wallet
      )
      await expect(
        exit({
          nft: nft.connect(other),
          tokenId,
          liquidity: 100,
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallet.address,
        })
      )
        .to.emit(pool, 'Burn')
        .to.emit(pool, 'Collect')
    })

    it('gas', async () => {
      await snapshotGasCost(
        exit({
          nft: nft.connect(other),
          tokenId,
          liquidity: 100,
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallet.address,
        })
      )
    })
  })

  describe('#tokenURI', async () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      let tx
      tx = await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      })
      await tx.wait()
    })

    it('reverts for invalid token id', async () => {
      await expect(nft.tokenURI(tokenId + 1)).to.be.reverted
    })

    it('returns a data URI with correct mime type', async () => {
      expect(await nft.tokenURI(tokenId)).to.match(/data:application\/json;base64,.+/)
    })

    it('content is valid JSON and structure', async () => {
      const content = extractJSONFromURI(await nft.tokenURI(tokenId))
      expect(content).to.haveOwnProperty('name').is.a('string')
      expect(content).to.haveOwnProperty('description').is.a('string')
      expect(content).to.haveOwnProperty('image').is.a('string')
    })
  })

  describe('fees accounting', () => {
    beforeEach('create two positions', async () => {
      let tx
      tx = await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()
      // nft 1 earns 25% of fees
      tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(FeeAmount.MEDIUM),
        tickUpper: getMaxTick(FeeAmount.MEDIUM),
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
        recipient: wallet.address,
      })
      await tx.wait()
      // nft 2 earns 75% of fees
      tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(FeeAmount.MEDIUM),
        tickUpper: getMaxTick(FeeAmount.MEDIUM),
        amount0Desired: 300,
        amount1Desired: 300,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
        recipient: wallet.address,
      })
      await tx.wait()
    })

    describe('10k of token0 fees collect', () => {
      beforeEach('swap for ~10k of fees', async () => {
        let tx
        const swapAmount = 3_333_333
        tx = await tokens[0].approve(router.address, swapAmount)
        await tx.wait()
        tx = await router.exactInput({
          recipient: wallet.address,
          deadline: 1,
          path: encodePath([tokens[0].address, tokens[1].address], [FeeAmount.MEDIUM]),
          amountIn: swapAmount,
          amountOutMinimum: 0,
        })
        await tx.wait()
      })

      // it('expected amounts', async () => {
      //   const { amount0: nft1Amount0, amount1: nft1Amount1 } = await nft.callStatic.collect({
      //     tokenId: 1,
      //     recipient: wallet.address,
      //     amount0Max: MaxUint128,
      //     amount1Max: MaxUint128,
      //   })
      //   const { amount0: nft2Amount0, amount1: nft2Amount1 } = await nft.callStatic.collect({
      //     tokenId: 2,
      //     recipient: wallet.address,
      //     amount0Max: MaxUint128,
      //     amount1Max: MaxUint128,
      //   })
      //   expect(nft1Amount0).to.eq(2501)
      //   expect(nft1Amount1).to.eq(0)
      //   expect(nft2Amount0).to.eq(7503)
      //   expect(nft2Amount1).to.eq(0)
      // })

      it('actually collected', async () => {
        const poolAddress = await computePoolAddress(
          factory,
          [tokens[0].address, tokens[1].address],
          FeeAmount.MEDIUM
        )

        // const tx = await nft.collect({
        //   tokenId: 1,
        //   recipient: wallet.address,
        //   amount0Max: MaxUint128,
        //   amount1Max: MaxUint128,
        // })
        // const receipt = await tx.wait()
        // console.log(receipt.logs)

        // console.log("wallet:", wallet.address)
        // console.log("token0:", tokens[0].address)
        // console.log("token1:", tokens[1].address)
        // console.log("")

        // for (let i = 0; i < receipt.logs.length; i++) {
        //   const log = receipt.logs[i]
        //   const topics = log.topics
        //   if (topics[0] == tokens[1].interface.getEventTopic(tokens[1].interface.events['Transfer(address,address,uint256)'])) {
        //     console.log("token:", log.address)
        //     console.log("from:", utils.hexDataSlice(topics[1], 12))
        //     console.log("to:", utils.hexDataSlice(topics[2], 12))
        //     console.log("amount:", parseInt(log.data))
        //   }
        // }

        // wallet: 0x36615Cf349d7F6344891B1e7CA7C72883F5dc049
        // token0: 0x1Da4fa70E0f7C497d07900e3C51fdcA00F96327D
        // token1: 0x269Be318d82CF3b1F0daF3dB6492046217157F60
        
        // token: 0x000000000000000000000000000000000000800A
        // from: 0x36615cf349d7f6344891b1e7ca7c72883f5dc049
        // to: 0x0000000000000000000000000000000000008001
        // amount: 81075500000000

        // token: 0x1Da4fa70E0f7C497d07900e3C51fdcA00F96327D
        // from: 0xb0df2a5a0df314e10ec38ce4fe2c6d108792d40d
        // to: 0x36615cf349d7f6344891b1e7ca7c72883f5dc049
        // amount: 2501

        // token: 0x000000000000000000000000000000000000800A
        // from: 0x0000000000000000000000000000000000008001
        // to: 0x36615cf349d7f6344891b1e7ca7c72883f5dc049
        // amount: 32990250000000
        
        await expect(
          nft.collect({
            tokenId: 1,
            recipient: wallet.address,
            amount0Max: MaxUint128,
            amount1Max: MaxUint128,
          })
        )
          .to.emit(tokens[0], 'Transfer')
          .withArgs(poolAddress, wallet.address, 2501)
          // .to.not.emit(tokens[1], 'Transfer') // check result above no Transfer emit for tokens[1], but test error
        await expect(
          nft.collect({
            tokenId: 2,
            recipient: wallet.address,
            amount0Max: MaxUint128,
            amount1Max: MaxUint128,
          })
        )
          .to.emit(tokens[0], 'Transfer')
          .withArgs(poolAddress, wallet.address, 7503)
        //   .to.not.emit(tokens[1], 'Transfer')
      })
    })
  })

  describe('#positions', async () => {
    it('gas', async () => {
      let tx
      // const positionsGasTestFactory = await ethers.getContractFactory('NonfungiblePositionManagerPositionsGasTest')
      // const positionsGasTest = (await positionsGasTestFactory.deploy(
      //   nft.address
      // )) as NonfungiblePositionManagerPositionsGasTest
      const positionsGasTest = await getContractInstance("NonfungiblePositionManagerPositionsGasTest", [nft.address])

      tx = await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )
      await tx.wait()

      tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: other.address,
        amount0Desired: 15,
        amount1Desired: 15,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })
      await tx.wait()

      await snapshotGasCost(positionsGasTest.getGasCostOfPositions(1))
    })
  })
})
