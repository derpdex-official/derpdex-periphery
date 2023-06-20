// import {
//   abi as FACTORY_ABI,
//   bytecode as FACTORY_BYTECODE,
// } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
// import { abi as FACTORY_V2_ABI, bytecode as FACTORY_V2_BYTECODE } from '@uniswap/v2-core/build/UniswapV2Factory.json'
// import { Fixture } from 'ethereum-waffle'
// import { ethers, waffle } from 'hardhat'
import { IUniswapV3Factory, IWETH9, MockTimeSwapRouter } from '../../../typechain'

// import WETH9 from '../../contracts/WETH9.json'
// import { Contract } from '@ethersproject/contracts'
// import { constants } from 'ethers'

import { Wallet, Provider, ContractFactory } from 'zksync-web3';
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as hre from 'hardhat';
import { UNISWAP_V3_FACTORY_ABI, UNISWAP_V3_FACTORY_BYTECODE, PRIVATE_KEY } from './constants'
import getContractInstance from './getContractInstance'

// const wethFixture: Fixture<{ weth9: IWETH9 }> = async ([wallet]) => {
//   const weth9 = (await waffle.deployContract(wallet, {
//     bytecode: WETH9.bytecode,
//     abi: WETH9.abi,
//   })) as IWETH9

//   return { weth9 }
// }
const wethFixture = async ([wallet]: Wallet[], provider: Provider) => {
  const weth9 = await getContractInstance("WETH9") as IWETH9

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

// const v3CoreFactoryFixture: Fixture<IUniswapV3Factory> = async ([wallet]) => {
//   return (await waffle.deployContract(wallet, {
//     bytecode: FACTORY_BYTECODE,
//     abi: FACTORY_ABI,
//   })) as IUniswapV3Factory
// }
export const v3CoreFactoryFixture = async ([wallet]: Wallet[], provider: Provider) => {
  // const abi = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":true,"internalType":"int24","name":"tickSpacing","type":"int24"}],"name":"FeeAmountEnabled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"oldOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnerChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token0","type":"address"},{"indexed":true,"internalType":"address","name":"token1","type":"address"},{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":false,"internalType":"int24","name":"tickSpacing","type":"int24"},{"indexed":false,"internalType":"address","name":"pool","type":"address"}],"name":"PoolCreated","type":"event"},{"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"}],"name":"createPool","outputs":[{"internalType":"address","name":"pool","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickSpacing","type":"int24"}],"name":"enableFeeAmount","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"","type":"uint24"}],"name":"feeAmountTickSpacing","outputs":[{"internalType":"int24","name":"","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"uint24","name":"","type":"uint24"}],"name":"getPool","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"parameters","outputs":[{"internalType":"address","name":"factory","type":"address"},{"internalType":"address","name":"token0","type":"address"},{"internalType":"address","name":"token1","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickSpacing","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"setOwner","outputs":[],"stateMutability":"nonpayable","type":"function"}]
  return await (new ContractFactory(UNISWAP_V3_FACTORY_ABI, UNISWAP_V3_FACTORY_BYTECODE, wallet)).deploy()
}

// export const v3RouterFixture: Fixture<{
//   weth9: IWETH9
//   factory: IUniswapV3Factory
//   router: MockTimeSwapRouter
// }> = async ([wallet], provider) => {
//   const { weth9 } = await wethFixture([wallet], provider)
//   const factory = await v3CoreFactoryFixture([wallet], provider)

//   const router = (await (await ethers.getContractFactory('MockTimeSwapRouter')).deploy(
//     factory.address,
//     weth9.address
//   )) as MockTimeSwapRouter

//   return { factory, weth9, router }
// }

// export const v3RouterFixture = async ([wallet]: Wallet[]) => {
//   const { weth9 } = await wethFixture([wallet])
//   const factory = await v3CoreFactoryFixture([wallet])

//   const deployer = new Deployer(hre, wallet)
//   const artifact = await deployer.loadArtifact("MockTimeSwapRouter")
//   const router = await deployer.deploy(artifact, [factory.address, weth9.address])

//   return { factory, weth9, router }
// }
export const v3RouterFixture = async ([wallet]: Wallet[], provider: Provider) => {
  const { weth9 } = await wethFixture([wallet], provider)
  const factory = await v3CoreFactoryFixture([wallet], provider) as IUniswapV3Factory

  const deployer = new Deployer(hre, wallet)
  const artifact = await deployer.loadArtifact("MockTimeSwapRouter")
  const router = await deployer.deploy(artifact, [factory.address, weth9.address]) as MockTimeSwapRouter

  return { factory, weth9, router }
}
