import { bytecode } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import { utils } from 'ethers'
import { IUniswapV3Factory } from '../../../typechain'

export const POOL_BYTECODE_HASH = utils.keccak256(bytecode)

export async function computePoolAddress(factory: IUniswapV3Factory, [tokenA, tokenB]: [string, string], fee: number): Promise<string> {
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA]
  // const constructorArgumentsEncoded = utils.defaultAbiCoder.encode(
  //   ['address', 'address', 'uint24'],
  //   [token0, token1, fee]
  // )
  // const create2Inputs = [
  //   '0xff',
  //   factoryAddress,
  //   // salt
  //   utils.keccak256(constructorArgumentsEncoded),
  //   // init code hash
  //   POOL_BYTECODE_HASH,
  // ]
  // const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`
  // return utils.getAddress(`0x${utils.keccak256(sanitizedInputs).slice(-40)}`)
  return await factory.getPool(token0, token1, fee)
}
