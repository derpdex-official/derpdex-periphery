// import { constants, Wallet } from 'ethers'
import { constants, utils } from 'ethers'
// import { waffle, ethers } from 'hardhat'

// import { Fixture } from 'ethereum-waffle'
import { SelfPermitTest, TestERC20PermitAllowed } from '../../typechain'
import { expect } from 'chai'
import { getPermitSignature } from './shared/permit'

import { Provider, Wallet } from 'zksync-web3'
import getContractInstance from './shared/getContractInstance'
import { PRIVATE_KEY } from './shared/constants'

describe('SelfPermit', () => {
  let wallet: Wallet
  let other: Wallet

  // const fixture: Fixture<{
  //   token: TestERC20PermitAllowed
  //   selfPermitTest: SelfPermitTest
  // }> = async (wallets, provider) => {
  const fixture = async (wallets: Wallet[], provider: Provider) => {
    // const tokenFactory = await ethers.getContractFactory('TestERC20PermitAllowed')
    // const token = (await tokenFactory.deploy(0)) as TestERC20PermitAllowed
    const token = (await getContractInstance("TestERC20PermitAllowed", [0])) as TestERC20PermitAllowed

    // const selfPermitTestFactory = await ethers.getContractFactory('SelfPermitTest')
    // const selfPermitTest = (await selfPermitTestFactory.deploy()) as SelfPermitTest
    const selfPermitTest = (await getContractInstance("SelfPermitTest")) as SelfPermitTest

    return {
      token,
      selfPermitTest,
    }
  }

  let token: TestERC20PermitAllowed
  let selfPermitTest: SelfPermitTest

  // let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    // const wallets = await (ethers as any).getSigners()
    // ;[wallet, other] = wallets
    // loadFixture = waffle.createFixtureLoader(wallets)
    const provider = Provider.getDefaultProvider()
    wallet = new Wallet(PRIVATE_KEY, provider)
    other = Wallet.createRandom().connect(provider)
    const tx = await wallet.transfer({ to: other.address, amount: utils.parseEther("1") })
    await tx.wait()
  })

  beforeEach('load fixture', async () => {
    // ;({ token, selfPermitTest } = await loadFixture(fixture))
    const provider = Provider.getDefaultProvider()
    ;({ token, selfPermitTest } = await fixture([wallet], provider))
  })

  it('#permit', async () => {
    const value = 123

    const { v, r, s } = await getPermitSignature(wallet, token, other.address, value)

    expect(await token.allowance(wallet.address, other.address)).to.be.eq(0)
    const tx = await token['permit(address,address,uint256,uint256,uint8,bytes32,bytes32)'](
      wallet.address,
      other.address,
      value,
      constants.MaxUint256,
      v,
      r,
      s
    )
    await tx.wait()
    expect(await token.allowance(wallet.address, other.address)).to.be.eq(value)
  })

  describe('#selfPermit', () => {
    const value = 456

    it('works', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, selfPermitTest.address, value)

      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(0)
      const tx = await selfPermitTest.selfPermit(token.address, value, constants.MaxUint256, v, r, s)
      await tx.wait()
      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(value)
    })

    it('fails if permit is submitted externally', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, selfPermitTest.address, value)

      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(0)
      const tx = await token['permit(address,address,uint256,uint256,uint8,bytes32,bytes32)'](
        wallet.address,
        selfPermitTest.address,
        value,
        constants.MaxUint256,
        v,
        r,
        s
      )
      await tx.wait()
      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(value)

      await expect(selfPermitTest.selfPermit(token.address, value, constants.MaxUint256, v, r, s)).to.be.revertedWith(
        'ERC20Permit: invalid signature'
      )
    })
  })

  describe('#selfPermitIfNecessary', () => {
    const value = 789

    it('works', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, selfPermitTest.address, value)

      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(0)
      const tx = await selfPermitTest.selfPermitIfNecessary(token.address, value, constants.MaxUint256, v, r, s)
      await tx.wait()
      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(value)
    })

    it('does not fail if permit is submitted externally', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, selfPermitTest.address, value)
      let tx

      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(0)
      tx = await token['permit(address,address,uint256,uint256,uint8,bytes32,bytes32)'](
        wallet.address,
        selfPermitTest.address,
        value,
        constants.MaxUint256,
        v,
        r,
        s
      )
      await tx.wait()
      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(value)

      tx = await selfPermitTest.selfPermitIfNecessary(token.address, value, constants.MaxUint256, v, r, s)
      await tx.wait()
    })
  })

  describe('#selfPermitAllowed', () => {
    it('works', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, selfPermitTest.address, constants.MaxUint256)

      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(0)
      await expect(selfPermitTest.selfPermitAllowed(token.address, 0, constants.MaxUint256, v, r, s))
        .to.emit(token, 'Approval')
        .withArgs(wallet.address, selfPermitTest.address, constants.MaxUint256)
      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(constants.MaxUint256)
    })

    it('fails if permit is submitted externally', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, selfPermitTest.address, constants.MaxUint256)

      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(0)
      const tx = await token['permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)'](
        wallet.address,
        selfPermitTest.address,
        0,
        constants.MaxUint256,
        true,
        v,
        r,
        s
      )
      await tx.wait()
      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(constants.MaxUint256)

      await expect(
        selfPermitTest.selfPermitAllowed(token.address, 0, constants.MaxUint256, v, r, s)
      ).to.be.revertedWith('TestERC20PermitAllowed::permit: wrong nonce')
    })
  })

  describe('#selfPermitAllowedIfNecessary', () => {
    it('works', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, selfPermitTest.address, constants.MaxUint256)

      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.eq(0)
      await expect(selfPermitTest.selfPermitAllowedIfNecessary(token.address, 0, constants.MaxUint256, v, r, s))
        .to.emit(token, 'Approval')
        .withArgs(wallet.address, selfPermitTest.address, constants.MaxUint256)
      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.eq(constants.MaxUint256)
    })

    it('skips if already max approved', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, selfPermitTest.address, constants.MaxUint256)

      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(0)
      const tx = await token.approve(selfPermitTest.address, constants.MaxUint256)
      await tx.wait()
      await expect(
        selfPermitTest.selfPermitAllowedIfNecessary(token.address, 0, constants.MaxUint256, v, r, s)
      ).to.not.emit(token, 'Approval')
      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.eq(constants.MaxUint256)
    })

    it('does not fail if permit is submitted externally', async () => {
      const { v, r, s } = await getPermitSignature(wallet, token, selfPermitTest.address, constants.MaxUint256)
      let tx

      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(0)
      tx = await token['permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)'](
        wallet.address,
        selfPermitTest.address,
        0,
        constants.MaxUint256,
        true,
        v,
        r,
        s
      )
      await tx.wait()
      expect(await token.allowance(wallet.address, selfPermitTest.address)).to.be.eq(constants.MaxUint256)

      tx = await selfPermitTest.selfPermitAllowedIfNecessary(token.address, 0, constants.MaxUint256, v, r, s)
      await tx.wait()
    })
  })
})
