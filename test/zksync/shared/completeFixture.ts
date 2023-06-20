import { Fixture } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { v3RouterFixture } from './externalFixtures'
import { constants } from 'ethers'
import {
  IWETH9,
  MockTimeNonfungiblePositionManager,
  MockTimeSwapRouter,
  NonfungibleTokenPositionDescriptor,
  TestERC20,
  IUniswapV3Factory,
} from '../../../typechain'
import { Provider, Wallet } from 'zksync-web3'
import getContractInstance from './getContractInstance'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'
import * as hre from "hardhat"

// const completeFixture: Fixture<{
//   weth9: IWETH9
//   factory: IUniswapV3Factory
//   router: MockTimeSwapRouter
//   nft: MockTimeNonfungiblePositionManager
//   nftDescriptor: NonfungibleTokenPositionDescriptor
//   tokens: [TestERC20, TestERC20, TestERC20]
// }> = async ([wallet], provider) => {
const completeFixture = async ([wallet]: Wallet[], provider: Provider) => {
  const { weth9, factory, router } = await v3RouterFixture([wallet], provider)

  // const tokenFactory = await ethers.getContractFactory('TestERC20')
  // const tokens: [TestERC20, TestERC20, TestERC20] = [
  //   (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20, // do not use maxu256 to avoid overflowing
  //   (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20,
  //   (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20,
  // ]
  const tokens: [TestERC20, TestERC20, TestERC20] = [
    (await getContractInstance("TestERC20", [constants.MaxUint256.div(2)])) as TestERC20, // do not use maxu256 to avoid overflowing
    (await getContractInstance("TestERC20", [constants.MaxUint256.div(2)])) as TestERC20,
    (await getContractInstance("TestERC20", [constants.MaxUint256.div(2)])) as TestERC20,
  ]

  // const nftDescriptorLibraryFactory = await ethers.getContractFactory('NFTDescriptor')
  // const nftDescriptorLibrary = await nftDescriptorLibraryFactory.deploy()
  // const positionDescriptorFactory = await ethers.getContractFactory('NonfungibleTokenPositionDescriptor', {
  //   libraries: {
  //     NFTDescriptor: nftDescriptorLibrary.address,
  //   },
  // })
  // const nftDescriptor = (await positionDescriptorFactory.deploy(
  //   tokens[0].address,
  //   // 'ETH' as a bytes32 string
  //   '0x4554480000000000000000000000000000000000000000000000000000000000'
  // )) as NonfungibleTokenPositionDescriptor
  const nftDescriptor = await getContractInstance("NonfungibleTokenPositionDescriptor", [
    tokens[0].address,
    "0x4554480000000000000000000000000000000000000000000000000000000000"
  ]) as NonfungibleTokenPositionDescriptor

  // const nftManager = await getContractInstance("NonfungiblePositionManager", [factory.address, weth9.address, nftDescriptor.address])
  // let tx = await nftManager.createAndInitializePoolIfNecessary(tokens[0].address, tokens[1].address, 500, 0)
  // await tx.wait()
  // await nftManager.positions(0)

  // const positionManagerFactory = await ethers.getContractFactory('MockTimeNonfungiblePositionManager')
  // const nft = (await positionManagerFactory.deploy(
  //   factory.address,
  //   weth9.address,
  //   nftDescriptor.address
  // )) as MockTimeNonfungiblePositionManager
  const nft = await getContractInstance(
    "MockTimeNonfungiblePositionManager",
    [factory.address, weth9.address, nftDescriptor.address]
  ) as MockTimeNonfungiblePositionManager
  // let tx = await nft.createAndInitializePoolIfNecessary(tokens[0].address, tokens[1].address, 500, 0)
  // await tx.wait()

  tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

  return {
    weth9,
    factory,
    router,
    tokens,
    nft,
    nftDescriptor,
  }
}

export default completeFixture
