// import {
//   abi as FACTORY_ABI,
//   bytecode as FACTORY_BYTECODE,
// } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
// import { Fixture } from 'ethereum-waffle'
// import { ethers, waffle } from 'hardhat'
import { IUniswapV3Factory, IWETH9, MockTimeSwapRouter } from '../../../typechain'

// import WETH9 from '../../contracts/WETH9.json'
// import { Contract } from '@ethersproject/contracts'
// import { constants } from 'ethers'

import { getContractInstance, getContractFactory } from './zkUtils'
import { ContractFactory, Provider, Wallet } from 'zksync-web3'
type Fixture<T> = (wallets: Wallet[], provider: Provider) => Promise<T>
const uniswapV3FactoryArtifact = require("../../contracts/UniswapV3Factory.sol/UniswapV3Factory.json")
const uniswapV3PoolArtifact = require("../../contracts/UniswapV3Pool.sol/UniswapV3Pool.json")

const wethFixture: Fixture<{ weth9: IWETH9 }> = async ([wallet]) => {
  // const weth9 = (await waffle.deployContract(wallet, {
  //   bytecode: WETH9.bytecode,
  //   abi: WETH9.abi,
  // })) as IWETH9
  const weth9 = await getContractInstance("WETH9") as unknown as IWETH9

  return { weth9 }
}

// this is for uniswap v3 migrator (migrate from v2) which is not applicable in DerpDeX
// export const v2FactoryFixture: Fixture<{ factory: Contract }> = async ([wallet]) => {
//   const factory = await waffle.deployContract(
//     wallet,
//     {
//       bytecode: FACTORY_V2_BYTECODE,
//       abi: FACTORY_V2_ABI,
//     },
//     [constants.AddressZero]
//   )

//   return { factory }
// }

const v3CoreFactoryFixture: Fixture<IUniswapV3Factory> = async ([wallet]) => {
  //   return (await waffle.deployContract(wallet, {
    //     bytecode: FACTORY_BYTECODE,
    //     abi: FACTORY_ABI,
    //   })) as IUniswapV3Factory
  const contractFactory = new ContractFactory(uniswapV3FactoryArtifact.abi, uniswapV3FactoryArtifact.bytecode, wallet)
  const factoryDeps = [uniswapV3PoolArtifact.bytecode]
  const uniswapV3Factory = await contractFactory.deploy({customData: {factoryDeps}})
  await uniswapV3Factory.deployed()
  return uniswapV3Factory as IUniswapV3Factory
}

export const v3RouterFixture: Fixture<{
  weth9: IWETH9
  factory: IUniswapV3Factory
  router: MockTimeSwapRouter
}> = async ([wallet], provider) => {
  const { weth9 } = await wethFixture([wallet], provider)
  const factory = await v3CoreFactoryFixture([wallet], provider) as IUniswapV3Factory

  // const router = (await (await ethers.getContractFactory('MockTimeSwapRouter')).deploy(
  const router = (await (await getContractFactory('MockTimeSwapRouter')).deploy(
    factory.address,
    weth9.address
  )) as MockTimeSwapRouter

  return { factory, weth9, router }
}
