// import { Fixture } from 'ethereum-waffle'
// import { constants, Wallet } from 'ethers'
import { constants, utils } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { MockTimeNonfungiblePositionManager, Quoter, TestERC20 } from '../../typechain'
import completeFixture from './shared/completeFixture'
import { FeeAmount, MaxUint128, PRIVATE_KEY, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { expect } from './shared/expect'
import { encodePath } from './shared/path'
import { createPool } from './shared/quoter'

import { Provider, Wallet } from 'zksync-web3'
import { getContractFactory, getSigners } from './shared/zkUtils'
const provider = Provider.getDefaultProvider()
type Fixture<T> = (wallets: Wallet[], provider: Provider) => Promise<T>

describe('Quoter', () => {
  let wallet: Wallet
  let trader: Wallet

  const swapRouterFixture: Fixture<{
    nft: MockTimeNonfungiblePositionManager
    tokens: [TestERC20, TestERC20, TestERC20]
    quoter: Quoter
  }> = async (wallets, provider) => {
    const { weth9, factory, router, tokens, nft } = await completeFixture(wallets, provider)

    // approve & fund wallets
    for (const token of tokens) {
      let tx
      tx = await token.approve(router.address, constants.MaxUint256)
      await tx.wait()
      tx = await token.approve(nft.address, constants.MaxUint256)
      await tx.wait()
      tx = await token.connect(trader).approve(router.address, constants.MaxUint256)
      await tx.wait()
      tx = await token.transfer(trader.address, expandTo18Decimals(1_000_000))
      await tx.wait()
    }

    // const quoterFactory = await ethers.getContractFactory('Quoter')
    const quoterFactory = await getContractFactory('Quoter')
    quoter = (await quoterFactory.deploy(factory.address, weth9.address)) as Quoter

    return {
      tokens,
      nft,
      quoter,
    }
  }

  let nft: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]
  let quoter: Quoter

  // let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    // const wallets = await (ethers as any).getSigners()
    const wallets = await getSigners()
    ;[wallet, trader] = wallets
    // loadFixture = waffle.createFixtureLoader(wallets)
  })

  // helper for getting weth and token balances
  beforeEach('load fixture', async () => {
    // ;({ tokens, nft, quoter } = await loadFixture(swapRouterFixture))
    ;({ tokens, nft, quoter } = await swapRouterFixture([wallet], provider))
  })

  describe('quotes', () => {
    beforeEach(async () => {
      let tx
      tx = await createPool(nft, wallet, tokens[0].address, tokens[1].address)
      await tx.wait()
      tx = await createPool(nft, wallet, tokens[1].address, tokens[2].address)
      await tx.wait()
    })

    describe('#quoteExactInput', () => {
      it('0 -> 1', async () => {
        const quote = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[0].address, tokens[1].address], [FeeAmount.MEDIUM]),
          3
        )

        expect(quote).to.eq(1)
      })

      it('1 -> 0', async () => {
        const quote = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[1].address, tokens[0].address], [FeeAmount.MEDIUM]),
          3
        )

        expect(quote).to.eq(1)
      })

      it('0 -> 1 -> 2', async () => {
        const quote = await quoter.callStatic.quoteExactInput(
          encodePath(
            tokens.map((token) => token.address),
            [FeeAmount.MEDIUM, FeeAmount.MEDIUM]
          ),
          5
        )

        expect(quote).to.eq(1)
      })

      it('2 -> 1 -> 0', async () => {
        const quote = await quoter.callStatic.quoteExactInput(
          encodePath(tokens.map((token) => token.address).reverse(), [FeeAmount.MEDIUM, FeeAmount.MEDIUM]),
          5
        )

        expect(quote).to.eq(1)
      })
    })

    describe('#quoteExactInputSingle', () => {
      it('0 -> 1', async () => {
        const quote = await quoter.callStatic.quoteExactInputSingle(
          tokens[0].address,
          tokens[1].address,
          FeeAmount.MEDIUM,
          MaxUint128,
          // -2%
          encodePriceSqrt(100, 102)
        )

        expect(quote).to.eq(9852)
      })

      it('1 -> 0', async () => {
        const quote = await quoter.callStatic.quoteExactInputSingle(
          tokens[1].address,
          tokens[0].address,
          FeeAmount.MEDIUM,
          MaxUint128,
          // +2%
          encodePriceSqrt(102, 100)
        )

        expect(quote).to.eq(9852)
      })
    })

    describe('#quoteExactOutput', () => {
      it('0 -> 1', async () => {
        const quote = await quoter.callStatic.quoteExactOutput(
          encodePath([tokens[1].address, tokens[0].address], [FeeAmount.MEDIUM]),
          1
        )

        expect(quote).to.eq(3)
      })

      it('1 -> 0', async () => {
        const quote = await quoter.callStatic.quoteExactOutput(
          encodePath([tokens[0].address, tokens[1].address], [FeeAmount.MEDIUM]),
          1
        )

        expect(quote).to.eq(3)
      })

      it('0 -> 1 -> 2', async () => {
        const quote = await quoter.callStatic.quoteExactOutput(
          encodePath(tokens.map((token) => token.address).reverse(), [FeeAmount.MEDIUM, FeeAmount.MEDIUM]),
          1
        )

        expect(quote).to.eq(5)
      })

      it('2 -> 1 -> 0', async () => {
        const quote = await quoter.callStatic.quoteExactOutput(
          encodePath(
            tokens.map((token) => token.address),
            [FeeAmount.MEDIUM, FeeAmount.MEDIUM]
          ),
          1
        )

        expect(quote).to.eq(5)
      })
    })

    describe('#quoteExactOutputSingle', () => {
      it('0 -> 1', async () => {
        const quote = await quoter.callStatic.quoteExactOutputSingle(
          tokens[0].address,
          tokens[1].address,
          FeeAmount.MEDIUM,
          MaxUint128,
          encodePriceSqrt(100, 102)
        )

        expect(quote).to.eq(9981)
      })

      it('1 -> 0', async () => {
        const quote = await quoter.callStatic.quoteExactOutputSingle(
          tokens[1].address,
          tokens[0].address,
          FeeAmount.MEDIUM,
          MaxUint128,
          encodePriceSqrt(102, 100)
        )

        expect(quote).to.eq(9981)
      })
    })
  })
})
