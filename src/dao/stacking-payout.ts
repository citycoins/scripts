import { stringAsciiCV, uintCV } from "micro-stacks/clarity";
import {
  AnchorMode,
  FungibleConditionCode,
  makeStandardSTXPostCondition,
  PostConditionMode,
} from "micro-stacks/transactions";
import { CityConfig, getCityConfig } from "../../lib/dao/citycoins";
import {
  DEFAULT_FEE,
  getStacksConfig,
  NETWORK,
  StacksConfig,
} from "../../lib/dao/stacks";
import { printIntro, sleep } from "../../lib/dao/utils";
import { deriveChildAccount, getNonce, submitTx } from "../../lib/stacks";

const deployer = "ST355N8734E5PVX9538H2QGMFP38RE211D9E2B4X5"; // ST8A9HZ3PKST0S42VM9523Z9NV42SZ026VZRMY61
const contractName = "ccd007-city-stacking"; // ccd011-stacking-payouts
const functionName = "send-stacking-reward"; // send-stacking-reward-mia -nyc
const amount = 1_000_000_000; // 1,000 STX
const cycle = 399;

async function quickPayout(stacks: StacksConfig, citycoins: CityConfig) {
  // get account address and private key
  const { address, key } = await deriveChildAccount(
    stacks.network,
    stacks.mnemonic,
    stacks.accountIndex
  );
  // get nonce
  const nonce = 28; // await getNonce(stacks.network, address);
  // print tx info
  console.log(`address for key: ${address}`);
  console.log(`nonce: ${nonce}`);
  console.log(`amount: ${amount}`);
  // create the payout tx
  const txOptions = {
    contractAddress: deployer, // citycoins.config.mining.deployer,
    contractName: contractName, // citycoins.config.mining.contractName,
    functionName: functionName, // citycoins.config.mining.miningFunction,
    functionArgs: [
      stringAsciiCV(citycoins.city.name.toLowerCase()),
      uintCV(cycle),
      uintCV(amount),
    ], // uintCV(cycle), uintCV(amount)
    senderKey: key,
    fee: DEFAULT_FEE,
    nonce: nonce,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      makeStandardSTXPostCondition(
        address,
        FungibleConditionCode.Equal,
        amount
      ),
    ],
    network: NETWORK(stacks.network),
    anchorMode: AnchorMode.Any,
  };
  // broadcast the tx
  console.log("pausing 0.5sec before submit...");
  await sleep(500);
  await submitTx(txOptions, stacks.network);
}

async function main() {
  printIntro(
    "Send Stacking Payout",
    "Builds and submits a stacking payout transaction for CityCoins on the Stacks blockchain.",
    true
  );
  const stacks = await getStacksConfig();
  const citycoins = await getCityConfig(stacks.network);
  // await mineMany(stacks);
  await quickPayout(stacks, citycoins);
}

main();
