import { stringAsciiCV, uintCV } from "micro-stacks/clarity";
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
  PostConditionMode,
} from "micro-stacks/transactions";
import {
  createAssetInfo,
  makeStandardFungiblePostCondition,
} from "@stacks/transactions";

async function getScriptConfig(network: string) {
  printDivider();
  console.log("SETTING SCRIPT CONFIGURATION");
  printDivider();
}

async function mineMany(stacks: StacksConfig) {}

async function quickAndDirtyStacking(
  stacks: StacksConfig,
  citycoins: CityConfig
) {
  // get account address and private key
  const { address, key } = await deriveChildAccount(
    stacks.network,
    stacks.mnemonic,
    stacks.accountIndex
  );
  const amountToStack = 1_000_000_000; // 1000 citycoins
  const numberOfCycles = 32;
  // get nonce
  const nonce = await getNonce(stacks.network, address);
  // print tx info
  console.log(`address for key: ${address}`);
  console.log(`nonce: ${nonce}`);
  console.log(
    `amountToStack: ${fromMicro(amountToStack)} ${
      citycoins.config.token.symbol
    }`
  );
  console.log(`numberOfCycles: ${numberOfCycles}`);
  // create the mining tx
  const txOptions = {
    contractAddress: citycoins.config.stacking.deployer,
    contractName: citycoins.config.stacking.contractName,
    functionName: citycoins.config.stacking.stackingFunction,
    functionArgs: [
      stringAsciiCV(citycoins.city.name.toLowerCase()),
      uintCV(amountToStack),
      uintCV(numberOfCycles),
    ],
    senderKey: key,
    fee: DEFAULT_FEE,
    nonce: nonce,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      makeStandardFungiblePostCondition(
        address,
        FungibleConditionCode.Equal,
        amountToStack,
        createAssetInfo(
          citycoins.config.token.deployer,
          citycoins.config.token.contractName,
          citycoins.config.token.tokenName
        )
      ),
    ],
    network: NETWORK(stacks.network),
    anchorMode: AnchorMode.Any,
  };
  // pause 15sec to allow checking data manually
  console.log("pausing 5sec before submit...");
  await sleep(5000);
  const txResult = await submitTx(txOptions, stacks.network);
  console.log("pausing 5sec after submit...");
  await sleep(5000);
  console.log(`txResult: ${JSON.stringify(txResult, null, 2)}`);
}

async function main() {
  printIntro(
    "Stack CityCoins",
    "Builds and submits a stacking transaction for CityCoins on the Stacks blockchain.",
    true
  );
  const stacks = await getStacksConfig();
  const citycoins = await getCityConfig(stacks.network);
  // const config = await getScriptConfig(stacks.network);
  await quickAndDirtyStacking(stacks, citycoins);
}

main();
