import { stringAsciiCV, uintCV } from "micro-stacks/clarity";
import { AnchorMode, PostConditionMode } from "micro-stacks/transactions";
import { CityConfig, getCityConfig } from "../../lib/dao/citycoins";
import { getStacksConfig, NETWORK, StacksConfig } from "../../lib/dao/stacks";
import { printDivider, printIntro, sleep } from "../../lib/dao/utils";
import {
  DEFAULT_FEE,
  deriveChildAccount,
  getNonce,
  getStacksBlockHeight,
  submitTx,
} from "../../lib/stacks";

async function getScriptConfig(network: string) {
  printDivider();
  console.log("SETTING SCRIPT CONFIGURATION");
  printDivider();
}

async function claimMiningReward(stacks: StacksConfig, citycoins: CityConfig) {
  printDivider();
  console.log("SCANNING SELECTED BLOCKS");
  printDivider();
  // get current block height
  const currentBlockHeight = await getStacksBlockHeight(stacks.network);
  // get account address and private key
  const { address, key } = await deriveChildAccount(
    stacks.network,
    stacks.mnemonic,
    stacks.accountIndex
  );
  const startBlock = 95737;
  const endBlock = 95762;
  const claimLimit = 25;
  let counter = 1;
  // get nonce
  let nonce = await getNonce(stacks.network, address);
  // print tx info
  console.log(`address for key: ${address}`);
  console.log(`nonce: ${nonce}`);
  console.log(`startBlock: ${startBlock}`);
  console.log(`endBlock: ${endBlock}`);
  for (let block = startBlock; block <= endBlock; block++) {
    printDivider();
    // exit loop if claim limit reached
    if (counter > claimLimit) {
      console.log(`claim limit reached: ${claimLimit}`);
      console.log(`startBlock: ${startBlock}`);
      console.log(`endBlock: ${endBlock}`);
      break;
    }
    console.log(`claiming block: ${block}`);
    // create the mining claim tx
    const txOptions = {
      contractAddress: citycoins.config.mining.deployer,
      contractName: citycoins.config.mining.contractName,
      functionName: citycoins.config.mining.miningClaimFunction,
      functionArgs: [
        stringAsciiCV(citycoins.city.name.toLowerCase()),
        uintCV(block),
      ],
      senderKey: key,
      fee: DEFAULT_FEE,
      nonce: nonce,
      postConditionMode: PostConditionMode.Deny,
      postConditions: [],
      network: NETWORK(stacks.network),
      anchorMode: AnchorMode.Any,
    };
    // broadcast the tx
    console.log("pausing 0.5sec before submit...");
    await sleep(500);
    await submitTx(txOptions, stacks.network);
    // increment nonce + counter
    nonce++;
    counter++;
  }
}

async function main() {
  printIntro(
    "Claim CityCoins Mining Block Reward",
    "Builds and submits a mining claim transaction for CityCoins on the Stacks blockchain.",
    true
  );
  const stacks = await getStacksConfig();
  const citycoins = await getCityConfig(stacks.network);
  // const config = await getScriptConfig(stacks.network);
  await claimMiningReward(stacks, citycoins);
}

main();
