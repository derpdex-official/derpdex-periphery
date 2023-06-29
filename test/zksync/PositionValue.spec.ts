// import { waffle, ethers } from 'hardhat'
// import { constants, BigNumberish, Contract } from 'ethers'
import { constants, BigNumberish } from 'ethers'
// import { Fixture } from 'ethereum-waffle'
import {
  PositionValueTest,
  SwapRouter,
  MockTimeNonfungiblePositionManager,
  // IUniswapV3Pool,
  TestERC20,
  IUniswapV3Factory,
} from '../../typechain'
import { FeeAmount, MaxUint128, PRIVATE_KEY, TICK_SPACINGS } from './shared/constants'
import { getMaxTick, getMinTick } from './shared/ticks'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { encodePath } from './shared/path'
import { computePoolAddress } from './shared/computePoolAddress'
import completeFixture from './shared/completeFixture'
import snapshotGasCost from './shared/snapshotGasCost'

import { expect } from './shared/expect'

import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'

import { Provider, Wallet, Contract } from 'zksync-web3'
import { getContractFactory } from './shared/zkUtils'
type Fixture<T> = (wallets: Wallet[], provider: Provider) => Promise<T>
const provider = Provider.getDefaultProvider()

describe('PositionValue', async () => {
  // const [...wallets] = waffle.provider.getWallets()
  const wallets = [new Wallet(PRIVATE_KEY, provider)]

  const positionValueCompleteFixture: Fixture<{
    positionValue: PositionValueTest
    tokens: [TestERC20, TestERC20, TestERC20]
    nft: MockTimeNonfungiblePositionManager
    router: SwapRouter
    factory: IUniswapV3Factory
  }> = async (wallets, provider) => {
    const { nft, router, tokens, factory } = await completeFixture(wallets, provider)
    // const positionValueFactory = await ethers.getContractFactory('PositionValueTest')
    const positionValueFactory = await getContractFactory('PositionValueTest')
    const positionValue = (await positionValueFactory.deploy()) as PositionValueTest

    for (const token of tokens) {
      let tx
      tx = await token.approve(nft.address, constants.MaxUint256)
      await tx.wait()
      tx = await token.connect(wallets[0]).approve(nft.address, constants.MaxUint256)
      await tx.wait()
      tx = await token.transfer(wallets[0].address, expandTo18Decimals(1_000_000))
      await tx.wait()
    }

    return {
      positionValue,
      tokens,
      nft,
      router,
      factory,
    }
  }

  let pool: Contract
  let tokens: [TestERC20, TestERC20, TestERC20]
  let positionValue: PositionValueTest
  let nft: MockTimeNonfungiblePositionManager
  let router: SwapRouter
  let factory: IUniswapV3Factory

  let amountDesired: BigNumberish

  // let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  // before('create fixture loader', async () => {
  //   loadFixture = waffle.createFixtureLoader(wallets)
  // })

  beforeEach(async () => {
    // ;({ positionValue, tokens, nft, router, factory } = await loadFixture(positionValueCompleteFixture))
    ;({ positionValue, tokens, nft, router, factory } = await positionValueCompleteFixture(wallets, provider))
    const tx = await nft.createAndInitializePoolIfNecessary(
      tokens[0].address,
      tokens[1].address,
      FeeAmount.MEDIUM,
      encodePriceSqrt(1, 1)
    )
    await tx.wait()

    const poolAddress = await computePoolAddress(factory.address, [tokens[0].address, tokens[1].address], FeeAmount.MEDIUM)
    pool = new Contract(poolAddress, IUniswapV3PoolABI, wallets[0])
  })

  describe('#total', () => {
    let tokenId: number
    let sqrtRatioX96: BigNumberish

    beforeEach(async () => {
      let tx
      amountDesired = expandTo18Decimals(100_000)

      tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })
      await tx.wait()

      const swapAmount = expandTo18Decimals(1_000)
      tx = await tokens[0].approve(router.address, swapAmount)
      await tx.wait()
      tx = await tokens[1].approve(router.address, swapAmount)
      await tx.wait()

      // accmuluate token0 fees
      tx = await router.exactInput({
        recipient: wallets[0].address,
        deadline: 1,
        path: encodePath([tokens[0].address, tokens[1].address], [FeeAmount.MEDIUM]),
        amountIn: swapAmount,
        amountOutMinimum: 0,
      })
      await tx.wait()

      // accmuluate token1 fees
      tx = await router.exactInput({
        recipient: wallets[0].address,
        deadline: 1,
        path: encodePath([tokens[1].address, tokens[0].address], [FeeAmount.MEDIUM]),
        amountIn: swapAmount,
        amountOutMinimum: 0,
      })
      await tx.wait()

      sqrtRatioX96 = (await pool.slot0()).sqrtPriceX96
    })

    it('returns the correct amount', async () => {
      const principal = await positionValue.principal(nft.address, 1, sqrtRatioX96)
      const fees = await positionValue.fees(nft.address, 1)
      const total = await positionValue.total(nft.address, 1, sqrtRatioX96)

      expect(total[0]).to.equal(principal[0].add(fees[0]))
      expect(total[1]).to.equal(principal[1].add(fees[1]))
    })

    it('gas', async () => {
      await snapshotGasCost(positionValue.totalGas(nft.address, 1, sqrtRatioX96))
    })
  })

  describe('#principal', () => {
    let sqrtRatioX96: BigNumberish

    beforeEach(async () => {
      amountDesired = expandTo18Decimals(100_000)
      sqrtRatioX96 = (await pool.slot0()).sqrtPriceX96
    })

    it('returns the correct values when price is in the middle of the range', async () => {
      const tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })
      await tx.wait()

      const principal = await positionValue.principal(nft.address, 1, sqrtRatioX96)
      expect(principal.amount0).to.equal('99999999999999999999999')
      expect(principal.amount1).to.equal('99999999999999999999999')
    })

    it('returns the correct values when range is below current price', async () => {
      const tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: -60,
        fee: FeeAmount.MEDIUM,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })
      await tx.wait()

      const principal = await positionValue.principal(nft.address, 1, sqrtRatioX96)
      expect(principal.amount0).to.equal('0')
      expect(principal.amount1).to.equal('99999999999999999999999')
    })

    it('returns the correct values when range is below current price', async () => {
      const tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: 60,
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })
      await tx.wait()

      const principal = await positionValue.principal(nft.address, 1, sqrtRatioX96)
      expect(principal.amount0).to.equal('99999999999999999999999')
      expect(principal.amount1).to.equal('0')
    })

    it('returns the correct values when range is skewed above price', async () => {
      const tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: -6_000,
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })
      await tx.wait()

      const principal = await positionValue.principal(nft.address, 1, sqrtRatioX96)
      expect(principal.amount0).to.equal('99999999999999999999999')
      expect(principal.amount1).to.equal('25917066770240321655335')
    })

    it('returns the correct values when range is skewed below price', async () => {
      const tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: 6_000,
        fee: FeeAmount.MEDIUM,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })
      await tx.wait()

      const principal = await positionValue.principal(nft.address, 1, sqrtRatioX96)
      expect(principal.amount0).to.equal('25917066770240321655335')
      expect(principal.amount1).to.equal('99999999999999999999999')
    })

    it('gas', async () => {
      const tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })
      await tx.wait()

      await snapshotGasCost(positionValue.principalGas(nft.address, 1, sqrtRatioX96))
    })
  })

  describe('#fees', () => {
    let tokenId: number

    beforeEach(async () => {
      amountDesired = expandTo18Decimals(100_000)
      tokenId = 2

      const tx = await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        fee: FeeAmount.MEDIUM,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      })
      await tx.wait()
    })

    describe('when price is within the position range', () => {
      beforeEach(async () => {
        let tx
        tx = await nft.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: TICK_SPACINGS[FeeAmount.MEDIUM] * -1_000,
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM] * 1_000,
          fee: FeeAmount.MEDIUM,
          recipient: wallets[0].address,
          amount0Desired: amountDesired,
          amount1Desired: amountDesired,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10,
        })
        await tx.wait()

        const swapAmount = expandTo18Decimals(1_000)
        tx = await tokens[0].approve(router.address, swapAmount)
        await tx.wait()
        tx = await tokens[1].approve(router.address, swapAmount)
        await tx.wait()

        // accmuluate token0 fees
        tx = await router.exactInput({
          recipient: wallets[0].address,
          deadline: 1,
          path: encodePath([tokens[0].address, tokens[1].address], [FeeAmount.MEDIUM]),
          amountIn: swapAmount,
          amountOutMinimum: 0,
        })
        await tx.wait()

        // accmuluate token1 fees
        tx = await router.exactInput({
          recipient: wallets[0].address,
          deadline: 1,
          path: encodePath([tokens[1].address, tokens[0].address], [FeeAmount.MEDIUM]),
          amountIn: swapAmount,
          amountOutMinimum: 0,
        })
        await tx.wait()
      })

      it('return the correct amount of fees', async () => {
        const feesFromCollect = await nft.callStatic.collect({
          tokenId,
          recipient: wallets[0].address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        })
        const feeAmounts = await positionValue.fees(nft.address, tokenId)

        expect(feeAmounts[0]).to.equal(feesFromCollect[0])
        expect(feeAmounts[1]).to.equal(feesFromCollect[1])
      })

      it('returns the correct amount of fees if tokensOwed fields are greater than 0', async () => {
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

        const swapAmount = expandTo18Decimals(1_000)
        tx = await tokens[0].approve(router.address, swapAmount)
        await tx.wait()

        // accmuluate more token0 fees after clearing initial amount
        tx = await router.exactInput({
          recipient: wallets[0].address,
          deadline: 1,
          path: encodePath([tokens[0].address, tokens[1].address], [FeeAmount.MEDIUM]),
          amountIn: swapAmount,
          amountOutMinimum: 0,
        })
        await tx.wait()

        const feesFromCollect = await nft.callStatic.collect({
          tokenId,
          recipient: wallets[0].address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        })
        const feeAmounts = await positionValue.fees(nft.address, tokenId)
        expect(feeAmounts[0]).to.equal(feesFromCollect[0])
        expect(feeAmounts[1]).to.equal(feesFromCollect[1])
      })

      it('gas', async () => {
        await snapshotGasCost(positionValue.feesGas(nft.address, tokenId))
      })
    })

    describe('when price is below the position range', async () => {
      beforeEach(async () => {
        let tx
        tx = await nft.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: TICK_SPACINGS[FeeAmount.MEDIUM] * -10,
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM] * 10,
          fee: FeeAmount.MEDIUM,
          recipient: wallets[0].address,
          amount0Desired: expandTo18Decimals(10_000),
          amount1Desired: expandTo18Decimals(10_000),
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10,
        })
        await tx.wait()

        tx = await tokens[0].approve(router.address, constants.MaxUint256)
        await tx.wait()
        tx = await tokens[1].approve(router.address, constants.MaxUint256)
        await tx.wait()

        // accumulate token1 fees
        tx = await router.exactInput({
          recipient: wallets[0].address,
          deadline: 1,
          path: encodePath([tokens[1].address, tokens[0].address], [FeeAmount.MEDIUM]),
          amountIn: expandTo18Decimals(1_000),
          amountOutMinimum: 0,
        })
        await tx.wait()

        // accumulate token0 fees and push price below tickLower
        tx = await router.exactInput({
          recipient: wallets[0].address,
          deadline: 1,
          path: encodePath([tokens[0].address, tokens[1].address], [FeeAmount.MEDIUM]),
          amountIn: expandTo18Decimals(50_000),
          amountOutMinimum: 0,
        })
        await tx.wait()
      })

      it('returns the correct amount of fees', async () => {
        const feesFromCollect = await nft.callStatic.collect({
          tokenId,
          recipient: wallets[0].address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        })

        const feeAmounts = await positionValue.fees(nft.address, tokenId)
        expect(feeAmounts[0]).to.equal(feesFromCollect[0])
        expect(feeAmounts[1]).to.equal(feesFromCollect[1])
      })

      it('gas', async () => {
        await snapshotGasCost(positionValue.feesGas(nft.address, tokenId))
      })
    })

    describe('when price is above the position range', async () => {
      beforeEach(async () => {
        let tx
        tx = await nft.mint({
          token0: tokens[0].address,
          token1: tokens[1].address,
          tickLower: TICK_SPACINGS[FeeAmount.MEDIUM] * -10,
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM] * 10,
          fee: FeeAmount.MEDIUM,
          recipient: wallets[0].address,
          amount0Desired: expandTo18Decimals(10_000),
          amount1Desired: expandTo18Decimals(10_000),
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10,
        })
        await tx.wait()

        tx = await tokens[0].approve(router.address, constants.MaxUint256)
        await tx.wait()
        tx = await tokens[1].approve(router.address, constants.MaxUint256)
        await tx.wait()

        // accumulate token0 fees
        tx = await router.exactInput({
          recipient: wallets[0].address,
          deadline: 1,
          path: encodePath([tokens[0].address, tokens[1].address], [FeeAmount.MEDIUM]),
          amountIn: expandTo18Decimals(1_000),
          amountOutMinimum: 0,
        })
        await tx.wait()

        // accumulate token1 fees and push price above tickUpper
        tx = await router.exactInput({
          recipient: wallets[0].address,
          deadline: 1,
          path: encodePath([tokens[1].address, tokens[0].address], [FeeAmount.MEDIUM]),
          amountIn: expandTo18Decimals(50_000),
          amountOutMinimum: 0,
        })
        await tx.wait()
      })

      it('returns the correct amount of fees', async () => {
        const feesFromCollect = await nft.callStatic.collect({
          tokenId,
          recipient: wallets[0].address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        })
        const feeAmounts = await positionValue.fees(nft.address, tokenId)
        expect(feeAmounts[0]).to.equal(feesFromCollect[0])
        expect(feeAmounts[1]).to.equal(feesFromCollect[1])
      })

      it('gas', async () => {
        await snapshotGasCost(positionValue.feesGas(nft.address, tokenId))
      })
    })
  })
})
