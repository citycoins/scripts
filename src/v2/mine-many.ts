import "cross-fetch/polyfill";
import prompts from "prompts";
import { listCV, UIntCV, uintCV } from "micro-stacks/clarity";
import { validateStacksAddress } from "micro-stacks/crypto";
import {
  AnchorMode,
  broadcastTransaction,
  FungibleConditionCode,
  makeContractCall,
  makeStandardSTXPostCondition,
  PostConditionMode,
} from "micro-stacks/transactions";
import {
  cancelPrompt,
  disclaimerIntro,
  exitError,
  exitSuccess,
  fixBigInt,
  fromMicro,
  getUserConfig,
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
} from "../../lib/stacks";
import {
  getFullCityConfig,
  getMiningStatsAtBlock,
  selectCityVersion,
} from "../../lib/citycoins";

async function setUserConfig() {
  printDivider();
  console.log("SETTING CONFIGURATION");
  printDivider();
  const currentBlockHeight = await getStacksBlockHeight();
  // prompt for user config
  const userConfig: any = await prompts(
    [
      {
        type: "select",
        name: "citycoin",
        message: "Select a CityCoin to mine:",
        choices: [
          { title: "MiamiCoin (MIA)", value: "MIA" },
          { title: "NewYorkCityCoin (NYC)", value: "NYC" },
        ],
      },
      {
        type: "number",
        name: "accountIndex",
        message: "Account index for Stacks address?",
        validate: (value) =>
          value < 0 ? "Account index must be greater than 0" : true,
      },
      {
        type: "password",
        name: "stxMnemonic",
        message: "Seed phrase for Stacks address?",
        validate: (value: string) =>
          value === "" ? "Stacks seed phrase is required" : true,
      },
      {
        type: "text",
        name: "stxAddress",
        message: "Confirm Stacks address from seed?",
        initial: async (prev: string, answers: any) => {
          const { address } = await deriveChildAccount(
            prev,
            answers.accountIndex
          );
          return address;
        },
        validate: (value: string) => {
          if (value === "") {
            return "Stacks address is required";
          }
          if (!validateStacksAddress(value)) {
            return "Invalid Stacks address";
          }
          return true;
        },
      },
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
        name: "customCommitValue",
        message: "Custom block commit value in uSTX? (1,000,000 uSTX = 1 STX)",
        validate: (value) =>
          value > 0 ? true : "Value must be greater than 0",
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
        name: "customFeeValue",
        message: "Custom fee value in uSTX? (1,000,000 uSTX = 1 STX)",
        validate: (value) =>
          value > 0 ? true : "Value must be greater than 0",
      },
    ],
    {
      onCancel: (prompt: any) => cancelPrompt(prompt.name),
    }
  );
  return userConfig;
}

async function getScriptConfig() {
  printDivider();
  console.log("SETTING SCRIPT CONFIGURATION");
  printDivider();
  const currentBlockHeight = await getStacksBlockHeight();
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
}

// TODO: break this up into smaller functions
async function setStrategy(userConfig: any) {
  printDivider();
  console.log("CALCULATING FEE AMOUNT");
  printDivider();

  let feeAmount = 0;

  // if custom fee, confirm fee amount
  if (userConfig.customFee) {
    const confirmFee = await prompts(
      {
        type: "toggle",
        name: "confirm",
        message: `Confirm custom tx fee? (${fromMicro(
          userConfig.feeAmount
        )} STX)`,
        initial: false,
        active: "Yes",
        inactive: "No",
      },
      { onCancel: (prompt: any) => cancelPrompt(prompt.name) }
    );
    printDivider();
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
    userConfig.feeAmount = await getOptimalFee(feeMultiplier.value);
  }
  console.log(`feeAmount: ${fromMicro(userConfig.feeAmount)} STX`);

  printDivider();
  console.log("CALCULATING COMMIT AMOUNT");
  printDivider();

  let commitAmount = 0;

  // if custom commit, confirm commit amount
  if (userConfig.customCommit) {
    const confirmCommit = await prompts(
      {
        type: "toggle",
        name: "confirm",
        message: `Confirm custom commit per block? (${fromMicro(
          userConfig.commitAmount
        )} STX)`,
        initial: false,
        active: "Yes",
        inactive: "No",
      },
      { onCancel: (prompt: any) => cancelPrompt(prompt.name) }
    );
    printDivider();
    if (!confirmCommit)
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
    // TODO: might need scriptConfig here too
    userConfig.commitAmount = await getBlockCommit(userConfig, commitStrategy);
    // check that commit doesn't exceed max commit
    if (userConfig.commitAmount > commitStrategy.maxCommitBlock) {
      console.log(`autoCommit: ${fromMicro(userConfig.commitAmount)} STX`);
      console.log("auto commit > max commit, using max commit...");
      userConfig.commitAmount = commitStrategy.maxCommitBlock;
    }
  }
  console.log(`commitAmount: ${fromMicro(userConfig.commitAmount)} STX`);

  // check that commit with fee doesn't exceed balance
  const balances = await getStacksBalances(userConfig.address);
  const stxBalance = balances.stx.balance;
  if (userConfig.commitAmount + userConfig.feeAmount > stxBalance) {
    console.log("commit + fee > balance, recalculating...");
    commitAmount = (stxBalance - feeAmount) / scriptConfig.numberOfBlocks;
  }

  // summarize TX info
  printDivider();
  console.log("TX INFORMATION");
  printDivider();
  console.log(`balance: ${fromMicro(stxBalance)} STX`);
  console.log(`commitAmount: ${fromMicro(commitAmount)} STX`);
  console.log(
    `commitTotal: ${fromMicro(commitAmount * config.numberOfBlocks)}`
  );
  console.log(`feeAmount: ${fromMicro(feeAmount)} STX`);

  const strategy = {
    commitAmount: commitAmount,
    feeAmount: feeAmount,
    commitTotal: commitAmount * config.numberOfBlocks,
  };

  return strategy;
}

async function getBlockCommit(userConfig: any, commitStrategy: any) {
  const currentBlockHeight = await getStacksBlockHeight();
  console.log(`currentBlockHeight: ${currentBlockHeight}`);
  console.log(`strategyDistance: ${commitStrategy.strategyDistance}`);
  // get historical average commit for selected distance
  const avgPast = await getBlockCommitAvg(
    -1,
    currentBlockHeight,
    userConfig,
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
    userConfig,
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
  userConfig: any,
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
    const result = await getMiningStatsAtBlock(
      "v2",
      userConfig.tokenSymbol,
      i,
      true
    );
    blockStats.push(+result.amount);
    // avoid API rate limiting
    await sleep(1000);
  }

  const sum = blockStats.reduce((a, b) => a + b, 0);
  const avg = sum / commitStrategy.strategyDistance;

  return avg;
}

async function mineManyTestnet(config: any, strategy: any): Promise<any> {
  // get account address and private key
  const { address, key } = await deriveChildAccount(
    config.stxMnemonic,
    config.accountIndex
  );
  // loop until target block is reached
  await waitUntilBlock(config.targetBlockHeight, address);
  printDivider();
  console.log("SENDING MINING TX");
  printDivider();
  // create the clarity values
  const mineManyArray: UIntCV[] = [];
  for (let i = 0; i < config.numberOfBlocks; i++) {
    mineManyArray.push(uintCV(parseInt(strategy.commitAmount)));
  }
  const mineManyArrayCV = listCV(mineManyArray);
  // get nonce
  const nonce = await getNonce(address);
  // print tx info\
  console.log(`address for key: ${address}`);
  console.log(`nonce: ${nonce}`);
  console.log(`commitAmount: ${fromMicro(strategy.commitAmount)} STX`);
  console.log(`numberOfBlocks: ${config.numberOfBlocks}`);
  console.log(`commitTotal: ${fromMicro(strategy.commitTotal)} STX`);
  console.log(`feeAmount: ${fromMicro(strategy.feeAmount)} STX`);
  // create the mining tx
  const currentBlockHeight = await getStacksBlockHeight();
  const cityConfig = await getFullCityConfig(config.citycoin.toLowerCase());
  const version = await selectCityVersion(
    config.citycoin.toLowerCase(),
    currentBlockHeight
  );
  const txOptions = {
    contractAddress: cityConfig[version].deployer,
    contractName: cityConfig[version].core.name,
    functionName: "mine-many",
    functionArgs: [mineManyArrayCV],
    senderKey: key,
    fee: parseInt(strategy.feeAmount),
    nonce: nonce,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      makeStandardSTXPostCondition(
        address,
        FungibleConditionCode.Equal,
        parseInt(strategy.commitTotal)
      ),
    ],
    network: STACKS_NETWORK,
    anchorMode: AnchorMode.Any,
  };
  // pause 10sec
  console.log("pausing 15sec before submit...");
  await sleep(15000);
  // TODO: refactor to new submitTx() format
  // submit tx
  try {
    console.log(`txOptions:\n${JSON.stringify(txOptions, fixBigInt, 2)}`);
    const transaction = await makeContractCall(txOptions);
    console.log(`transaction:\n${JSON.stringify(transaction, fixBigInt, 2)}`);
    const broadcastResult = await broadcastTransaction(
      transaction,
      STACKS_NETWORK
    );
    if (!broadcastResult) exitError("why is this broken?");
    console.log(
      `broadcast result: ${JSON.stringify(broadcastResult, fixBigInt, 2)})}`
    );
    console.log("pausing 15sec after submit...");
    await sleep(15000);
    // setup and wait for next transaction
    const nextTarget = await monitorTx(broadcastResult, transaction.txid());
    if (config.continuousMining || config.numberOfRuns > 0) {
      config.numberOfRuns -= 1;
      config.targetBlockHeight = nextTarget + config.numberOfBlocks;
      printDivider();
      console.log("RESTARTING WITH NEW TARGET");
      printDivider();
      console.log(`nextTarget: ${config.targetBlockHeight}`);
      console.log(
        `remainingTxs: ${
          config.continousMining ? "until balance spent" : config.numberOfRuns
        }`
      );
      return await mineManyTestnet(config, strategy);
    }
  } catch (err) {
    exitError(String(err));
  }
}

async function main() {
  disclaimerIntro(
    "Mine Many Testnet",
    "Builds and submits mine-many transactions for CityCoins on Stacks with advanced options including continuous mining and automatic commit/fee calculations.",
    true
  );
  const userConfig = getUserConfig();
  const scriptConfig = getScriptConfig();
  const miningStrategy = await setStrategy(userConfig);
  await mineManyTestnet(userConfig, scriptConfig, miningStrategy);
  printDivider();
  exitSuccess("all actions complete, script exiting...");
}

main();
