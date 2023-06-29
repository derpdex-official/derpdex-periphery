import { utils, Wallet, Provider } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import addresses from "../addresses";

export default async function (hre: HardhatRuntimeEnvironment) {
    //@ts-ignore
    const allAddresses = addresses[process.env.NODE_ENV || "local"]

    const factoryAddress = allAddresses.factoryAddress
    const WETH9Address = allAddresses.WETH
    const NFTPositionManagerAddress = allAddresses.NFTPositionManagerAddress

    // let pk = process.env.pk
    
    let pk_testnet = process.env.pk || ""

    const provider = Provider.getDefaultProvider();

    const wallet = new Wallet(pk_testnet/* , provider */);
    const deployer = new Deployer(hre, wallet);
    

    // const depositAmount = ethers.utils.parseEther("0.001");
    // const depositHandle = await deployer.zkWallet.deposit({
    //   to: deployer.zkWallet.address,
    //   token: utils.ETH_ADDRESS,
    //   amount: depositAmount,
    // });

    // await depositHandle.wait();

    const TickLensArtifact = await deployer.loadArtifact("TickLens");
    console.log("Deploying TickLensArtifact...");
    const TickLensContract = await deployer.deploy(TickLensArtifact, []);
    await TickLensContract.deployTransaction.wait(15);
    console.log(`${TickLensArtifact.contractName} was deployed to ${TickLensContract.address}`);

    const QuoterV2Artifact = await deployer.loadArtifact("QuoterV2");
    console.log("Deploying QuoterV2...");
    const QuoterV2Contract = await deployer.deploy(QuoterV2Artifact, [factoryAddress, WETH9Address]);
    await QuoterV2Contract.deployTransaction.wait(15);
    console.log(`${QuoterV2Artifact.contractName} was deployed to ${QuoterV2Contract.address}`);

    const V3MigratorArtifact = await deployer.loadArtifact("V3Migrator");
    console.log("Deploying V3Migrator...");
    const V3MigratorContract = await deployer.deploy(V3MigratorArtifact, [factoryAddress, WETH9Address, NFTPositionManagerAddress]);
    await V3MigratorContract.deployTransaction.wait(15);
    console.log(`${V3MigratorArtifact.contractName} was deployed to ${V3MigratorContract.address}`);


    console.log("Starting verification")
    console.log("verifying TickLens")
    await hre.run("verify:verify", {
        address: TickLensContract.address,
        constructorArguments: [],
    });

    console.log("verifying QuoterV2")
    await hre.run("verify:verify", {
        address: QuoterV2Contract.address,
        constructorArguments: [factoryAddress, WETH9Address],
    });

    console.log("verifying V3Migrator")
    await hre.run("verify:verify", {
        address: V3MigratorContract.address,
        constructorArguments: [factoryAddress, WETH9Address, NFTPositionManagerAddress],
    });
}