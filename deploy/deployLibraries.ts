import { utils, Wallet, Provider } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

export default async function (hre: HardhatRuntimeEnvironment) {

    let pk_testnet = process.env.pk || ""

    const provider = Provider.getDefaultProvider();

    const wallet = new Wallet(pk_testnet/* , provider */);
    // const wallet = new Wallet(pk, provider);
    const deployer = new Deployer(hre, wallet);

    const nftDescriptorLibraryArtifact = await deployer.loadArtifact("NFTDescriptor");
    const nftDescriptorLibraryContract = await deployer.deploy(nftDescriptorLibraryArtifact, []);
    
    console.log("nftDescriptorLibrary", nftDescriptorLibraryContract.address)
}