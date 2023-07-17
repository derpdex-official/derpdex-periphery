# Periphery Contracts  
This repository contains the periphery smart contracts for the DerpDEX Protocol. For the lower level core contracts, see the [derpdex-core](https://github.com/derpdex-official/derpdex-core) repository.

## Bug bounty
This repository is subject to DerpDEX bug bounty program, per terms defined [here](bug-bounty.md).

## Addresses

| Contract | Testnet | Mainnet |
| --- | --- | --- |
| `SwapRouter` | [`0x28b6EFCd70F7165644B55c844181EdF31687aA65`](https://goerli.explorer.zksync.io/address/0x28b6EFCd70F7165644B55c844181EdF31687aA65) | [`0x3de80D2d9dCa6F6357C77EF89ee1f7Db3Bba3c3f`](https://explorer.zksync.io/address/0x3de80D2d9dCa6F6357C77EF89ee1f7Db3Bba3c3f) |
| `PositionManager` | [`0xf70B4CD44b0750f2eEbb1A943f7a6c27C67E98C3`](https://goerli.explorer.zksync.io/address/0xf70B4CD44b0750f2eEbb1A943f7a6c27C67E98C3) | [`0x7F4cB0666B700dF62E7fD0aB30e7C354Aa0A1890`](https://explorer.zksync.io/address/0x7F4cB0666B700dF62E7fD0aB30e7C354Aa0A1890) |
| `WETH9` | [`0xC3ec043C150c945652A09D7E47F856AC9fB0F893`](https://goerli.explorer.zksync.io/address/0xC3ec043C150c945652A09D7E47F856AC9fB0F893) | [`0x5aea5775959fbc2557cc8789bc1bf90a239d9a91`](https://explorer.zksync.io/address/0x5aea5775959fbc2557cc8789bc1bf90a239d9a91) | 
| `NFTDescriptor` | [`0x43A23E0849A42BE02e1FE376848252a9537E2953`](https://goerli.explorer.zksync.io/address/0x43A23E0849A42BE02e1FE376848252a9537E2953) | [`0xA1E4b0a4FcF829d725F0267840eeB0ce18749BF5`](https://explorer.zksync.io/address/0xA1E4b0a4FcF829d725F0267840eeB0ce18749BF5) |
| `TickLens` | [`0xB00156710AbB3D1186C7c2C78CEdDcAECA6aC45B`](https://goerli.explorer.zksync.io/address/0xB00156710AbB3D1186C7c2C78CEdDcAECA6aC45B) | [`0xc5A4875617A4935f2f063B050b66925DDd1FB2C0`](https://explorer.zksync.io/address/0xc5A4875617A4935f2f063B050b66925DDd1FB2C0) |
| `QuoterV2` | [`0x0c225eF0Df2655bdDC457c1674301C83b7B4Ed8a`](https://goerli.explorer.zksync.io/address/0x0c225eF0Df2655bdDC457c1674301C83b7B4Ed8a) | [`0x48237655EFC513a79409882643eC987591dd6a81`](https://explorer.zksync.io/address/0x48237655EFC513a79409882643eC987591dd6a81) |
|  `V3Migrator` | [`0xC55656d0f182E3E463F05Edb2BCBFc6e854BF5Cd`](https://goerli.explorer.zksync.io/address/0xC55656d0f182E3E463F05Edb2BCBFc6e854BF5Cd) | [`0xb1ef06BCC2A8F63597d5779c00D72b2ae4bb592C`](https://explorer.zksync.io/address/0xb1ef06BCC2A8F63597d5779c00D72b2ae4bb592C) |
|  `nftDescriptorLibrary` | [`0xe66F80eF756010719b1c4eeF59eED3fE3a4c255A`](https://goerli.explorer.zksync.io/address/0xe66F80eF756010719b1c4eeF59eED3fE3a4c255A) | [`0x69B41D94DA0a3415dAb6b80d3Bb501BE5bafb03A`](https://explorer.zksync.io/address/0x69B41D94DA0a3415dAb6b80d3Bb501BE5bafb03A) |

## Deployment
Three zksync networks are supported (local, testnet, mainnet). The `NODE_ENV` environment variable should be updated before deploying the contracts.
### 1. NFTDescriptor
The NFTDescriptor library should be deployed first and the address should be updated in `addresses/index.ts`.

``` sh
export NODE_ENV=mainnet
yarn hardhat copmile && yarn hardhat deploy-zksync --script deploy/01_deployLibraries.ts
``` 

The address should be updated to the `addresses/index.ts` file.

### 2. Periphery Contracts
``` sh
export NODE_ENV=mainnet
yarn hardhat copmile && yarn hardhat deploy-zksync --script deploy/02_deploy.ts
``` 

After deployment, address of `NonfungiblePositionManager` contract should be updated in `addresses/index.ts` 

### 3. Other Contracts
``` sh
export NODE_ENV=mainnet
yarn hardhat copmile && yarn hardhat deploy-zksync --script deploy/03_deployOthers.ts
``` 

## Manual Verification
The deploy scripts will verify the contracts. Following command can be used to manually verify the contracts.

``` sh
$ yarn hardhat verify --network zkSyncNetwork CONTRACT_ADDRESS CONSTRUCTOR_PARAMS 
```

### To check verification Status
``` sh
$ yarn hardhat verify-status --verification-id VERIFICATION_ID
```
