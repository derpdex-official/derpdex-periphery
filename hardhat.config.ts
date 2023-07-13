import * as dotenv from 'dotenv'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-typechain'
import 'hardhat-watcher'
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import 'hardhat-deploy'
import "@matterlabs/hardhat-zksync-verify";
import addresses from './addresses'
dotenv.config()

const zkSyncNetwork = (() => {
  if (process.env.NODE_ENV == "local") {
    return {
      url: "http://localhost:3050",
      ethNetwork: "http://localhost:8545",
      // ethNetwork: "http://localhost:8646",
      zksync: true,
    }
  } else if (process.env.NODE_ENV == "testnet") {
    return {
      url: "https://testnet.era.zksync.dev",
      // ethNetwork: "goerli",
      ethNetwork: process.env.goerli_rpc,
      zksync: true,
      verifyURL: 'https://zksync2-testnet-explorer.zksync.dev/contract_verification'
    }
  } else if(process.env.NODE_ENV == "mainnet") {
    return {
      url: process.env.ZKSYNC_MAINNET_RPC,
      ethNetwork: process.env.mainnet_rpc,
      zksync: true,
      verifyURL: process.env.ZKSYNC_MAINNET_VERIFY_URL
    }
  } else {
    throw new Error("Please use one of the following NODE_ENV (local, testnet, mainnet)")
  }
}) ()

console.log("zkSyncNetwork", zkSyncNetwork)

const LOW_OPTIMIZER_COMPILER_SETTINGS = {
  version: '0.7.6',
  settings: {
    evmVersion: 'istanbul',
    optimizer: {
      enabled: true,
      runs: 2_000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

const LOWEST_OPTIMIZER_COMPILER_SETTINGS = {
  version: '0.7.6',
  settings: {
    evmVersion: 'istanbul',
    optimizer: {
      enabled: true,
      runs: 1_000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

const DEFAULT_COMPILER_SETTINGS = {
  version: '0.7.6',
  settings: {
    evmVersion: 'istanbul',
    optimizer: {
      enabled: true,
      runs: 1_000_000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

export default {
  zksolc: {
    version: "1.3.5",
    compilerSource: "binary",
    settings: {
      libraries: {
        "contracts/libraries/NFTDescriptor.sol": { //@ts-ignore
          NFTDescriptor: addresses[process.env.NODE_ENV].NFTDescriptor
        }
      }
    },
  },
  defaultNetwork: "zkSyncNetwork",
  networks: {
    zkSyncNetwork,
    hardhat: {
      allowUnlimitedContractSize: false,
      zksync: false,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
    },
    arbitrumRinkeby: {
      url: `https://arbitrum-rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
    },
    arbitrum: {
      url: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
    },
    optimismKovan: {
      url: `https://optimism-kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
    },
    optimism: {
      url: `https://optimism-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  solidity: {
    compilers: [DEFAULT_COMPILER_SETTINGS],
    // overrides: {
    //   'contracts/NonfungiblePositionManager.sol': LOW_OPTIMIZER_COMPILER_SETTINGS,
    //   'contracts/test/MockTimeNonfungiblePositionManager.sol': LOW_OPTIMIZER_COMPILER_SETTINGS,
    //   'contracts/test/NFTDescriptorTest.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
    //   'contracts/NonfungibleTokenPositionDescriptor.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
    //   'contracts/libraries/NFTDescriptor.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
    // },
  },
  watcher: {
    test: {
      tasks: [{ command: 'test', params: { testFiles: ['{path}'] } }],
      files: ['./test/**/*'],
      verbose: true,
    },
  },
}