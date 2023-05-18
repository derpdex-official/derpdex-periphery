import { utils, Wallet, Provider } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

export default async function (hre: HardhatRuntimeEnvironment) {
    const factoryAddress = "0x72B37018BfD6F78c7c7509Bf77f8D1d4bd206dBD"
    // const factoryAddress = "0x329e3D402920785aA7208d58622103d286cB4fd2" //hardhat
    const nativeCurrencyLabel = "ETH"
    // let pk = process.env.pk
    
    let pk_testnet = process.env.pk || ""

    const provider = Provider.getDefaultProvider();

    const wallet = new Wallet(pk_testnet/* , provider */);
    // const wallet = new Wallet(pk, provider);
    const deployer = new Deployer(hre, wallet);
    

    // const depositAmount = ethers.utils.parseEther("0.001");
    // const depositHandle = await deployer.zkWallet.deposit({
    //   to: deployer.zkWallet.address,
    //   token: utils.ETH_ADDRESS,
    //   amount: depositAmount,
    // });

    // await depositHandle.wait();

    const WETH9Artifact = await deployer.loadArtifact("WETH9");
    console.log("Deploying WETH9...");
    let WETH9Contract = await deployer.deploy(WETH9Artifact, []);

    // const WETH9Address = "0x8945c87563489B1f58DfFa462077844012A43e4c" //WETH9Contract.address;
    const WETH9Address = WETH9Contract.address;
    console.log(`${WETH9Artifact.contractName} was deployed to ${WETH9Address}`);

    const SwapRouterArtifact = await deployer.loadArtifact("SwapRouter");

    console.log("Deploying SwapRouter...");
    let routerContract = await deployer.deploy(SwapRouterArtifact, [factoryAddress, WETH9Address]);

    //@ts-ignore
    const contractAddress = routerContract.address;
    console.log(`${SwapRouterArtifact.contractName} was deployed to ${contractAddress}`);

    const NonfungibleTokenPositionDescriptorArtifact = await deployer.loadArtifact("NonfungibleTokenPositionDescriptor");
    console.log("Deploying NonfungibleTokenPositionDescriptor...");
    const NonfungibleTokenPositionDescriptorContract = await deployer.deploy(NonfungibleTokenPositionDescriptorArtifact,
        [factoryAddress, ethers.utils.formatBytes32String(nativeCurrencyLabel)]
    );
    const NonfungibleTokenPositionDescriptorAddress = NonfungibleTokenPositionDescriptorContract.address;
    console.log(`${NonfungibleTokenPositionDescriptorArtifact.contractName} was deployed to ${NonfungibleTokenPositionDescriptorAddress}`);

    const NonfungiblePositionManager = await deployer.loadArtifact("NonfungiblePositionManager");
    console.log("Deploying NonfungiblePositionManager...");
    const NonfungiblePositionManagerContract = await deployer.deploy(NonfungiblePositionManager,
        [factoryAddress, WETH9Address, NonfungibleTokenPositionDescriptorAddress]
        // [factoryAddress, "0x8945c87563489B1f58DfFa462077844012A43e4c", "0xe6E743eaA1de83d44a6f8B744bb52B0d29dcd972"] //testnet
    );
    const NonfungiblePositionManagerAddress = NonfungiblePositionManagerContract.address;
    console.log(`${NonfungiblePositionManager.contractName} was deployed to ${NonfungiblePositionManagerAddress}`);
}