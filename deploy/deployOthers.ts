import { utils, Wallet, Provider } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

export default async function (hre: HardhatRuntimeEnvironment) {
    const factoryAddress = "0x72B37018BfD6F78c7c7509Bf77f8D1d4bd206dBD"
    const WETH9Address = "0x5672B500550E9916C9967E18F67915407D70C62e"
    const NFTPositionManagerAddress = "0x40fBd61d55607Fc21621F84B8337fA9C1145B70A"

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

    // const TickLensArtifact = await deployer.loadArtifact("TickLens");
    // console.log("Deploying TickLensArtifact...");
    // const TickLensContract = await deployer.deploy(TickLensArtifact, []);
    // console.log(`${TickLensArtifact.contractName} was deployed to ${TickLensContract.address}`);

    const QuoterV2Artifact = await deployer.loadArtifact("QuoterV2");
    console.log("Deploying QuoterV2...");
    const QuoterV2Contract = await deployer.deploy(QuoterV2Artifact, [factoryAddress, WETH9Address]);
    console.log(`${QuoterV2Artifact.contractName} was deployed to ${QuoterV2Contract.address}`);

    const V3MigratorArtifact = await deployer.loadArtifact("V3Migrator");
    console.log("Deploying V3Migrator...");
    const V3MigratorContract = await deployer.deploy(V3MigratorArtifact, [factoryAddress, WETH9Address, NFTPositionManagerAddress]);
    console.log(`${V3MigratorArtifact.contractName} was deployed to ${V3MigratorContract.address}`);
}