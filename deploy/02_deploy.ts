import { utils, Wallet, Provider } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import addresses from "../addresses";

export default async function (hre: HardhatRuntimeEnvironment) {
    //@ts-ignore
    const allAddresses = addresses[process.env.NODE_ENV || "local"]
    const factoryAddress = allAddresses.factoryAddress
    const nativeCurrencyLabel = "ETH"
    
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

    // const WETH9Artifact = await deployer.loadArtifact("WETH9");
    // console.log("Deploying WETH9...");
    // let WETH9Contract = await deployer.deploy(WETH9Artifact, []);

    const WETH9Address = allAddresses.WETH
    // const WETH9Address = "0x801a9Fa5e21979c940c8714B87CF6388F2328b4c" //hardhat
    // const WETH9Address = WETH9Contract.address;
    // console.log(`${WETH9Artifact.contractName} was deployed to ${WETH9Address}`);

    const SwapRouterArtifact = await deployer.loadArtifact("SwapRouter");

    console.log("Deploying SwapRouter...");
    let routerContract = await deployer.deploy(SwapRouterArtifact, [factoryAddress, WETH9Address]);

    // @ts-ignore
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
    );

    await NonfungiblePositionManagerContract.deployTransaction.wait(15)
    const NonfungiblePositionManagerAddress = NonfungiblePositionManagerContract.address;
    console.log(`${NonfungiblePositionManager.contractName} was deployed to ${NonfungiblePositionManagerAddress}`);


    //verify 
    console.log("staring verification")
    console.log("verifying SwapRouter")
    await hre.run("verify:verify", {
        address: routerContract.address,
        constructorArguments: [factoryAddress, WETH9Address],
    })

    console.log("verifying NonfungibleTokenPositionDescriptor")
    await hre.run("verify:verify", {
        address: NonfungibleTokenPositionDescriptorContract.address,
        constructorArguments: [factoryAddress, ethers.utils.formatBytes32String(nativeCurrencyLabel)],
    })

    console.log("verifying NonfungiblePositionManager")
    await hre.run("verify:verify", {
        address: NonfungiblePositionManagerContract.address,
        constructorArguments: [factoryAddress, WETH9Address, NonfungibleTokenPositionDescriptorAddress],
    })
}