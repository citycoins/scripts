import { uintCV } from "micro-stacks/clarity";
import {
  AnchorMode,
  FungibleConditionCode,
  makeStandardSTXPostCondition,
  PostConditionMode,
} from "micro-stacks/transactions";
import { CityConfig, getCityConfig } from "../../lib/dao/citycoins";
import { getStacksConfig, NETWORK, StacksConfig } from "../../lib/dao/stacks";
import {
  exitError,
  fromMicro,
  printDivider,
  printIntro,
  sleep,
} from "../../lib/dao/utils";
import {
  DEFAULT_FEE,
  deriveChildAccount,
  getNonce,
  getStacksBalances,
  submitTx,
} from "../../lib/stacks";

async function depositToTreasury(stacks: StacksConfig, citycoins: CityConfig) {
  const deployer = "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH";
  const getContractName = () => {
    if (citycoins.city.name === "mia") return "ccd002-treasury-mia-mining";
    if (citycoins.city.name === "nyc") return "ccd002-treasury-nyc-mining";
    exitError(`${citycoins.city.name} is not a valid city name`);
  };
  const contractName = getContractName();
  // const contractName = "ccd002-treasury-nyc-mining";
  const functionName = "deposit-stx";
  // get account address and private key
  const { address, key } = await deriveChildAccount(
    stacks.network,
    stacks.mnemonic,
    stacks.accountIndex
  );

  // get balance for address
  const balances = await getStacksBalances(stacks.network, address);
  const stxBalance = Number(balances["stx"]["balance"]);
  const amount = stxBalance - DEFAULT_FEE;
  // get nonce
  const nonce = await getNonce(stacks.network, address);
  // print tx info
  console.log(`deployer: ${deployer}`);
  console.log(`contractName: ${contractName}`);
  console.log(`functionName: ${functionName}`);
  console.log(`address for key: ${address}`);
  console.log(`nonce: ${nonce}`);
  console.log(`balance: ${fromMicro(stxBalance)} STX`);
  console.log(`amount: ${fromMicro(amount)} STX`);

  // create the deposit tx
  const txOptions = {
    contractAddress: deployer,
    contractName,
    functionName,
    functionArgs: [uintCV(amount)],
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
  // pause 5sec to allow checking data manually
  console.log("pausing 30sec before submit...");
  await sleep(30000);
  const txResult = await submitTx(txOptions, stacks.network);
  console.log("pausing 5sec after submit...");
  await sleep(5000);
  console.log(`txResult: ${JSON.stringify(txResult, null, 2)}`);
}

async function main() {
  printIntro(
    "Deposit to CCD002 treasury",
    "Builds and submits a deposit transaction to a CCD002 supported treasury for the entire balance of an account.",
    true
  );
  const stacks = await getStacksConfig();
  const citycoins = await getCityConfig(stacks.network);
  // do the magic
  await depositToTreasury(stacks, citycoins);
}

main();
