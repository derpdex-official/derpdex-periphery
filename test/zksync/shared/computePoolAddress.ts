// import { bytecode } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import { utils } from 'ethers'
import { utils as zkUtils } from 'zksync-web3'
const poolArtifact = require('../../contracts/UniswapV3Pool.sol/UniswapV3Pool.json')

export const POOL_BYTECODE_HASH = zkUtils.hashBytecode(poolArtifact.bytecode)

export async function computePoolAddress(factoryAddress: string, [tokenA, tokenB]: [string, string], fee: number): Promise<string> {
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA]
  const constructorArgumentsEncoded = utils.defaultAbiCoder.encode(
    ['address', 'address', 'uint24'],
    [token0, token1, fee]
  )
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
  const prefix = utils.keccak256(utils.toUtf8Bytes('zksyncCreate2'))
  const inputHash = utils.keccak256("0x")
  const salt = utils.keccak256(constructorArgumentsEncoded)
  const addressBytes = utils
    .keccak256(utils.concat([prefix, utils.zeroPad(factoryAddress, 32), salt, POOL_BYTECODE_HASH, inputHash]))
    .slice(26)
  return utils.getAddress(addressBytes)
}
