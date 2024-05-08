import "cross-fetch/polyfill";
import prompts from "prompts";
import { listCV, UIntCV, uintCV } from "micro-stacks/clarity";
import {
  AnchorMode,
  FungibleConditionCode,
  makeStandardSTXPostCondition,
  PostConditionMode,
} from "micro-stacks/transactions";
import {
  cancelPrompt,
  disclaimerIntro,
  exitError,
  exitSuccess,
  fromMicro,
  getUserConfig,
  printAddress,
  printDivider,
  sleep,
  waitUntilBlock,
} from "../../lib/utils";
import {
  deriveChildAccount,
  getNonce,
  getOptimalFee,
  getStacksBalances,
  getStacksBlockHeight,
  monitorTx,
  STACKS_NETWORK,
  submitTx,
} from "../../lib/stacks";
import {
  CityConfig,
  getFullCityConfig,
  getMiningStatsAtBlock,
  selectCityVersion,
} from "../../lib/citycoins";

let currentBlockHeight = 0;

async function getScriptConfig(network: string) {
  printDivider();
  console.log("SETTING SCRIPT CONFIGURATION");
  printDivider();
  currentBlockHeight = await getStacksBlockHeight(network);
  // prompt for script configuration
  const scriptConfig = await prompts(
    [
      {
        type: "toggle",
        name: "continuousMining",
        message: "Continuously mine with full STX balance?",
        initial: false,
        active: "Yes",
        inactive: "No",
      },
      {
        type: (prev) => (prev ? null : "number"),
        name: "numberOfRuns",
        message: "Number of mining TX to send?",
        validate: (value) =>
          value < 1 ? "Value must be greater than 0" : true,
      },
      {
        type: "number",
        name: "numberOfBlocks",
        message: "Number of blocks to mine per TX? (1-200)",
        validate: (value) =>
          value < 1 || value > 200 ? "Value must be between 1 and 200" : true,
      },
      {
        type: "toggle",
        name: "startNow",
        message: "Start mining now?",
        initial: true,
        active: "Yes",
        inactive: "No",
      },
      {
        type: (prev) => (prev ? null : "number"),
        name: "targetBlockHeight",
        message: `Target block height? (current: ${currentBlockHeight})`,
        validate: (value) =>
          value < currentBlockHeight
            ? `Value must be equal to or greater than current block height: ${currentBlockHeight}`
            : true,
      },
      {
        type: "toggle",
        name: "customCommit",
        message: "Set custom commit per block?",
        initial: false,
        active: "Yes",
        inactive: "No",
      },
      {
        type: (prev) => (prev ? "number" : null),
        name: "commitAmount",
        message: "Custom block commit value in uSTX? (1,000,000 uSTX = 1 STX)",
        validate: (value) =>
          value > 0 ? true : "Value must be greater than 0",
      },
      {
        type: null,
        name: "commitTotal",
        message: "Total commit amount in uSTX? (1,000,000 uSTX = 1 STX)",
      },
      {
        type: "toggle",
        name: "customFee",
        message: `Set custom fee per TX?`,
        initial: false,
        active: "Yes",
        inactive: "No",
      },
      {
        type: (prev) => (prev ? "number" : null),
        name: "feeAmount",
        message: "Custom fee value in uSTX? (1,000,000 uSTX = 1 STX)",
        validate: (value) =>
          value > 0 ? true : "Value must be greater than 0",
      },
    ],
    {
      onCancel: (prompt: any) => cancelPrompt(prompt.name),
    }
  );

  if (scriptConfig.startNow)
    scriptConfig.targetBlockHeight = currentBlockHeight;

  return scriptConfig;
}

// TODO: break this up into smaller functions
async function setMiningStrategy(
  userConfig: any,
  scriptConfig: any,
  cityConfig: CityConfig
) {
  printDivider();
  console.log("CALCULATING FEE AMOUNT");
  printDivider();

  // if custom fee, confirm fee amount
  if (scriptConfig.customFee) {
    const confirmFee = await prompts(
      {
        type: "toggle",
        name: "confirm",
        message: `Confirm custom tx fee? (${fromMicro(
          scriptConfig.feeAmount
        )} STX)`,
        initial: false,
        active: "Yes",
        inactive: "No",
      },
      { onCancel: (prompt: any) => cancelPrompt(prompt.name) }
    );
    if (!confirmFee) exitError("Custom fee amount not confirmed, exiting...");
  } else {
    // else get strategy info to set fee amount
    const feeMultiplier = await prompts(
      {
        type: "number",
        name: "value",
        message: "Fee multiplier for tx in mempool? (default: 1)",
        validate: (value) =>
          value > 0 ? true : "Value must be greater than 0",
      },
      { onCancel: (prompt: any) => cancelPrompt(prompt.name) }
    );
    printDivider();
    // set fee amount based on strategy
    scriptConfig.feeAmount = await getOptimalFee(
      userConfig.network,
      feeMultiplier.value
    );
  }

  printDivider();
  console.log("CALCULATING COMMIT AMOUNT");
  printDivider();

  // if custom commit, confirm commit amount
  if (scriptConfig.customCommit) {
    const confirmCommit = await prompts(
      {
        type: "toggle",
        name: "confirm",
        message: `Confirm custom commit per block? (${fromMicro(
          scriptConfig.commitAmount
        )} STX)`,
        initial: false,
        active: "Yes",
        inactive: "No",
      },
      { onCancel: (prompt: any) => cancelPrompt(prompt.name) }
    );
    if (!confirmCommit.confirm)
      exitError("Custom commit amount not confirmed, exiting...");
  } else {
    // else get strategy info to set commit amount
    const commitStrategy = await prompts(
      [
        {
          type: "number",
          name: "strategyDistance",
          message: "Number of blocks to search for strategy?",
          validate: (value) => {
            if (value < 1 || value > 100)
              return "Value must be between 1 and 100";
            return true;
          },
        },
        {
          type: "number",
          name: "targetPercentage",
          message: "Target percentage of total block commit?",
          validate: (value) => {
            if (value === "") return "Target percentage is required";
            if (value < 1 || value > 100)
              return "Value must be between 1 and 100";
            return true;
          },
        },
        {
          type: "number",
          name: "maxCommitBlock",
          message: "Max commit per block in uSTX? (1,000,000 uSTX = 1 STX)",
        },
      ],
      { onCancel: (prompt: any) => cancelPrompt(prompt.name) }
    );
    // verify max commit set by user or exit
    const confirmMax = await prompts(
      {
        type: "toggle",
        name: "value",
        message: `Confirm max commit per block: ${fromMicro(
          commitStrategy.maxCommitBlock
        )} STX?`,
        initial: false,
        active: "Yes",
        inactive: "No",
      },
      {
        onCancel: (prompt: any) => cancelPrompt(prompt.name),
      }
    );
    printDivider();
    if (!confirmMax.value)
      exitError("ERROR: max commit not confirmed, exiting...");
    // set commit value based on strategy
    scriptConfig.commitAmount = await getBlockCommit(
      userConfig.network,
      cityConfig,
      commitStrategy
    );
    // check that commit doesn't exceed max commit
    if (scriptConfig.commitAmount > commitStrategy.maxCommitBlock) {
      console.log(`autoCommit: ${fromMicro(scriptConfig.commitAmount)} STX`);
      console.log("auto commit > max commit, using max commit...");
      scriptConfig.commitAmount = commitStrategy.maxCommitBlock;
    }
  }

  // check that commit with fee doesn't exceed balance
  const balances = await getStacksBalances(
    userConfig.network,
    userConfig.address
  );
  const stxBalance = balances.stx.balance;
  if (scriptConfig.commitAmount + scriptConfig.feeAmount > stxBalance) {
    console.log("commit + fee > balance, recalculating...");
    scriptConfig.commitAmount =
      (stxBalance - scriptConfig.feeAmount) / scriptConfig.numberOfBlocks;
  }

  scriptConfig.commitTotal =
    scriptConfig.commitAmount * scriptConfig.numberOfBlocks;

  // summarize TX info
  printDivider();
  console.log("TX INFORMATION");
  printDivider();
  printAddress(userConfig.address);
  console.log(`balance: ${fromMicro(stxBalance)} STX`);
  console.log(`commitAmount: ${fromMicro(scriptConfig.commitAmount)} STX`);
  console.log(`numberOfBlocks: ${scriptConfig.numberOfBlocks}`);
  console.log(`commitTotal: ${fromMicro(scriptConfig.commitTotal)} STX`);
  console.log(`feeAmount: ${fromMicro(scriptConfig.feeAmount)} STX`);
}

async function getBlockCommit(
  network: string,
  cityConfig: CityConfig,
  commitStrategy: any
) {
  currentBlockHeight = await getStacksBlockHeight(network);
  console.log(`currentBlockHeight: ${currentBlockHeight}`);
  console.log(`strategyDistance: ${commitStrategy.strategyDistance}`);
  // get historical average commit for selected distance
  const avgPast = await getBlockCommitAvg(
    -1,
    currentBlockHeight,
    cityConfig.token.symbol,
    commitStrategy
  );
  console.log(`avgPast: ${fromMicro(avgPast)} STX`);
  const commitPast = Math.round(
    avgPast * (commitStrategy.targetPercentage / 100)
  );
  // get future average commit for selected distance
  const avgFuture = await getBlockCommitAvg(
    1,
    currentBlockHeight,
    cityConfig.token.symbol,
    commitStrategy
  );
  console.log(`avgFuture: ${fromMicro(avgFuture)} STX`);
  const commitFuture = Math.round(
    avgFuture * (commitStrategy.targetPercentage / 100)
  );
  const commitAmount = Math.round((commitPast + commitFuture) / 2);
  return commitAmount;
}

async function getBlockCommitAvg(
  direction: number,
  currentBlock: number,
  tokenSymbol: string,
  commitStrategy: any
): Promise<number> {
  const targetBlock =
    currentBlock + commitStrategy.strategyDistance * direction;
  const blockStats = [];

  for (
    let i = currentBlock;
    direction > 0 ? i < targetBlock : i > targetBlock;
    direction > 0 ? i++ : i--
  ) {
    const result = await getMiningStatsAtBlock("v2", tokenSymbol, i, true);
    blockStats.push(+result.amount);
    // avoid API rate limiting
    await sleep(1000);
  }

  const sum = blockStats.reduce((a, b) => a + b, 0);
  const avg = sum / commitStrategy.strategyDistance;

  return avg;
}

async function mineManyTestnet(
  userConfig: any,
  scriptConfig: any,
  cityConfig: CityConfig
): Promise<any> {
  // get account address and private key
  const { address, key } = await deriveChildAccount(
    userConfig.network,
    userConfig.mnemonic,
    userConfig.accountIndex
  );
  // loop until target block is reached
  await waitUntilBlock(
    userConfig.network,
    scriptConfig.targetBlockHeight,
    address
  );
  printDivider();
  console.log("SENDING MINING TX");
  printDivider();
  // create the clarity values
  const mineManyArray: UIntCV[] = [];
  for (let i = 0; i < scriptConfig.numberOfBlocks; i++) {
    mineManyArray.push(uintCV(parseInt(scriptConfig.commitAmount)));
  }
  const mineManyArrayCV = listCV(mineManyArray);
  // get nonce
  const nonce = await getNonce(userConfig.network, address);
  // print tx info
  console.log(`address for key: ${address}`);
  console.log(`nonce: ${nonce}`);
  console.log(`commitAmount: ${fromMicro(scriptConfig.commitAmount)} STX`);
  console.log(`numberOfBlocks: ${scriptConfig.numberOfBlocks}`);
  console.log(`commitTotal: ${fromMicro(scriptConfig.commitTotal)} STX`);
  console.log(`feeAmount: ${fromMicro(scriptConfig.feeAmount)} STX`);
  // create the mining tx
  const txOptions = {
    contractAddress: cityConfig.deployer,
    contractName: cityConfig.core.name,
    functionName: "mine-many",
    functionArgs: [mineManyArrayCV],
    senderKey: key,
    fee: parseInt(scriptConfig.feeAmount),
    nonce: nonce,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      makeStandardSTXPostCondition(
        address,
        FungibleConditionCode.Equal,
        parseInt(scriptConfig.commitTotal)
      ),
    ],
    network: STACKS_NETWORK,
    anchorMode: AnchorMode.Any,
  };
  // pause 15sec to allow checking data manually
  console.log("pausing 15sec before submit...");
  await sleep(15000);
  const txResult = await submitTx(txOptions, userConfig.network);
  if (txResult !== undefined) {
    // pause 15sec to allow tx propagation to nodes
    console.log("pausing 15sec after submit...");
    await sleep(15000);
    const nextTarget = await monitorTx(userConfig.network, txResult);
    if (scriptConfig.continuousMining || scriptConfig.numberOfRuns > 0) {
      scriptConfig.numberOfRuns -= 1;
      scriptConfig.targetBlockHeight = nextTarget + scriptConfig.numberOfBlocks;
      printDivider();
      console.log("RESTARTING WITH NEW TARGET");
      printDivider();
      console.log(`nextTarget: ${scriptConfig.targetBlockHeight}`);
      console.log(
        `remainingTxs: ${
          scriptConfig.continousMining
            ? "until balance spent"
            : scriptConfig.numberOfRuns
        }`
      );
      return await mineManyTestnet(userConfig, scriptConfig, cityConfig);
    } else {
      exitError("Error broadcasting transaction, result undefined, exiting...");
    }
  }
}

async function main() {
  disclaimerIntro(
    "Mine Many Testnet",
    "Builds and submits mine-many transactions for CityCoins on Stacks with advanced options including continuous mining and automatic commit/fee calculations.",
    true
  );
  console.log(`WARNING: commit amounts must be set manually for now`);
  const userConfig = await getUserConfig();
  const scriptConfig = await getScriptConfig(userConfig.network);
  const cityConfig = await getFullCityConfig(userConfig.citycoin.toLowerCase());
  const version = await selectCityVersion(
    userConfig.citycoin.toLowerCase(),
    currentBlockHeight
  );
  if (version === "")
    exitError(`Error: no version found for ${userConfig.citycoin}`);
  await setMiningStrategy(userConfig, scriptConfig, cityConfig[version]);
  await mineManyTestnet(userConfig, scriptConfig, cityConfig[version]);
  printDivider();
  exitSuccess("all actions complete, script exiting...");
}

main();
