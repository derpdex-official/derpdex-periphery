# Periphery Contracts  

## Addresses

| Contract | Testnet | Mainnet |
| --- | --- | --- |
| `SwapRouter` | [`0x28b6EFCd70F7165644B55c844181EdF31687aA65`](https://goerli.explorer.zksync.io/address/0x28b6EFCd70F7165644B55c844181EdF31687aA65) | - |
|`PositionManager` | [`0xf70B4CD44b0750f2eEbb1A943f7a6c27C67E98C3`](https://goerli.explorer.zksync.io/address/0xf70B4CD44b0750f2eEbb1A943f7a6c27C67E98C3) | - |
| `WETH9` | [`0xC3ec043C150c945652A09D7E47F856AC9fB0F893`](https://goerli.explorer.zksync.io/address/0xC3ec043C150c945652A09D7E47F856AC9fB0F893) | - | 
| `NFTDescriptor` | [`0x43A23E0849A42BE02e1FE376848252a9537E2953`](https://goerli.explorer.zksync.io/address/0x43A23E0849A42BE02e1FE376848252a9537E2953) | - |
|`TickLens` | [`0xB00156710AbB3D1186C7c2C78CEdDcAECA6aC45B`](https://goerli.explorer.zksync.io/address/0xB00156710AbB3D1186C7c2C78CEdDcAECA6aC45B) | - |
| `QuoterV2` | [`0x0c225eF0Df2655bdDC457c1674301C83b7B4Ed8a`](https://goerli.explorer.zksync.io/address/0x0c225eF0Df2655bdDC457c1674301C83b7B4Ed8a) | - |
|  `V3Migrator` | [`0xC55656d0f182E3E463F05Edb2BCBFc6e854BF5Cd`](https://goerli.explorer.zksync.io/address/0xC55656d0f182E3E463F05Edb2BCBFc6e854BF5Cd) | - |
|  `nftDescriptorLibrary` | [`0xe66F80eF756010719b1c4eeF59eED3fE3a4c255A`](https://goerli.explorer.zksync.io/address/0xe66F80eF756010719b1c4eeF59eED3fE3a4c255A) | - |

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