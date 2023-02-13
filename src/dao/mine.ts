import { listCV, stringAsciiCV, uintCV, UIntCV } from "micro-stacks/clarity";
import { CityConfig, getCityConfig } from "../../lib/dao/citycoins";
import {
  DEFAULT_FEE,
  getStacksConfig,
  NETWORK,
  StacksConfig,
} from "../../lib/dao/stacks";
import {
  fromMicro,
  printDivider,
  printIntro,
  sleep,
} from "../../lib/dao/utils";
import { deriveChildAccount, getNonce, submitTx } from "../../lib/stacks";
import {
  AnchorMode,
  FungibleConditionCode,
  makeStandardSTXPostCondition,
  PostConditionMode,
} from "micro-stacks/transactions";

async function getScriptConfig(network: string) {
  printDivider();
  console.log("SETTING SCRIPT CONFIGURATION");
  printDivider();
}

async function mineMany(stacks: any) {}

async function quickAndDirtyMining(
  stacks: StacksConfig,
  citycoins: CityConfig
) {
  // get account address and private key
  const { address, key } = await deriveChildAccount(
    stacks.network,
    stacks.mnemonic,
    stacks.accountIndex
  );
  const amountPerBlock = 1000000; // 1 STX per block
  const numberOfBlocks = 200;
  const totalCommit = amountPerBlock * numberOfBlocks;
  const mineManyArray: UIntCV[] = [];
  for (let i = 0; i < numberOfBlocks; i++) {
    mineManyArray.push(uintCV(amountPerBlock));
  }
  const mineManyArrayCV = listCV(mineManyArray);
  // get nonce
  const nonce = await getNonce(stacks.network, address);
  // print tx info
  console.log(`address for key: ${address}`);
  console.log(`nonce: ${nonce}`);
  console.log(`commitAmount: ${fromMicro(amountPerBlock)} STX`);
  console.log(`numberOfBlocks: ${numberOfBlocks}`);
  console.log(`commitTotal: ${fromMicro(totalCommit)} STX`);
  // create the mining tx
  const txOptions = {
    contractAddress: citycoins.config.mining.deployer,
    contractName: citycoins.config.mining.contractName,
    functionName: citycoins.config.mining.miningFunction,
    functionArgs: [
      stringAsciiCV(citycoins.city.name.toLowerCase()),
      mineManyArrayCV,
    ],
    senderKey: key,
    fee: DEFAULT_FEE,
    nonce: nonce,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      makeStandardSTXPostCondition(
        address,
        FungibleConditionCode.Equal,
        totalCommit
      ),
    ],
    network: NETWORK(stacks.network),
    anchorMode: AnchorMode.Any,
  };
  // pause 5sec to allow checking data manually
  console.log("pausing 5sec before submit...");
  await sleep(5000);
  const txResult = await submitTx(txOptions, stacks.network);
  console.log("pausing 5sec after submit...");
  await sleep(5000);
  console.log(`txResult: ${JSON.stringify(txResult, null, 2)}`);
}

async function main() {
  printIntro(
    "Mine CityCoins",
    "Builds and submits a mining transaction for CityCoins on the Stacks blockchain, with advanced options including continuous mining.",
    true
  );
  const stacks = await getStacksConfig();
  const citycoins = await getCityConfig(stacks.network);
  // await mineMany(stacks);
  await quickAndDirtyMining(stacks, citycoins);
}

main();
