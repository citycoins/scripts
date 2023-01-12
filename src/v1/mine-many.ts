import "cross-fetch/polyfill";
import prompts from "prompts";
import {
  cancelPrompt,
  disclaimerIntro,
  exitError,
  exitSuccess,
  fromMicro,
  printAddress,
  printDivider,
  sleep,
  waitUntilBlock,
} from "../../lib/utils";
import {
  getNonce,
  getOptimalFee,
  getStacksBalances,
  getStacksBlockHeight,
  monitorTx,
  STACKS_NETWORK,
} from "../../lib/stacks";
import { validateStacksAddress } from "micro-stacks/crypto";
import { getMiningStatsAtBlock } from "../../lib/citycoins";
import { listCV, UIntCV, uintCV } from "micro-stacks/clarity";
import {
  AnchorMode,
  broadcastTransaction,
  FungibleConditionCode,
  makeContractCall,
  makeStandardSTXPostCondition,
  PostConditionMode,
} from "micro-stacks/transactions";

async function setUserConfig() {
  const currentBlockHeight = await getStacksBlockHeight();
  // set submit action for prompts
  // to add CityCoin contract values
  // TODO: generalize this same way as CityCoins UI
  // using constants returned from CityCoins API
  const submit = (prompt: any, answer: any, answers: any) => {
    if (prompt.name === "citycoin") {
      switch (answer) {
        case "MIA":
          answers.contractAddress = "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R";
          answers.contractName = "miamicoin-core-v2";
          answers.tokenSymbol = "MIA";
          break;
        case "NYC":
          answers.contractAddress = "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11";
          answers.contractName = "newyorkcitycoin-core-v2";
          answers.tokenSymbol = "NYC";
          break;
      }
    }
    if (prompt.name === "startNow" && answer === true) {
      answers.targetBlockHeight = currentBlockHeight;
    }
  };
  printDivider();
  console.log("SETTING CONFIGURATION");
  printDivider();
  // prompt for user config
  const userConfig = await prompts(
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
        type: "text",
        name: "stxSender",
        message: "Stacks Address to mine with?",
        validate: (value: string) =>
          validateStacksAddress(value)
            ? true
            : "Valid Stacks address is required",
      },
      {
        type: "password",
        name: "stxPrivateKey",
        message: "Private Key for Stacks address?",
        validate: (value: string) =>
          value === "" ? "Stacks private key is required" : true,
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
      onSubmit: submit,
    }
  );
  return userConfig;
}

async function setStrategy(config: any) {
  printDivider();
  console.log("CALCULATING FEE AMOUNT");
  printDivider();

  let feeAmount = 0;

  // if custom fee, confirm fee amount
  if (config.customFee) {
    const confirmFee = await prompts(
      {
        type: "toggle",
        name: "confirm",
        message: `Confirm custom tx fee? (${fromMicro(
          config.customFeeValue
        )} STX)`,
        initial: false,
        active: "Yes",
        inactive: "No",
      },
      { onCancel: (prompt: any) => cancelPrompt(prompt.name) }
    );
    printDivider();
    if (!confirmFee) exitError("Custom fee amount not confirmed, exiting...");
    feeAmount = config.customFeeValue;
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
    feeAmount = await getOptimalFee(feeMultiplier.value);
  }
  console.log(`feeAmount: ${fromMicro(feeAmount)} STX`);

  printDivider();
  console.log("CALCULATING COMMIT AMOUNT");
  printDivider();

  let commitAmount = 0;

  // if custom commit, confirm commit amount
  if (config.customCommit) {
    const confirmCommit = await prompts(
      {
        type: "toggle",
        name: "confirm",
        message: `Confirm custom commit per block? (${fromMicro(
          config.customCommitValue
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
    commitAmount = config.customCommitValue;
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
    commitAmount = await getBlockCommit(config, commitStrategy);
    // check that commit doesn't exceed max commit
    if (commitAmount > commitStrategy.maxCommitBlock) {
      console.log(`autoCommit: ${fromMicro(commitAmount)} STX`);
      console.log("auto commit > max commit, using max commit...");
      commitAmount = commitStrategy.maxCommitBlock;
    }
  }
  console.log(`commitAmount: ${fromMicro(commitAmount)} STX`);

  // check that commit with fee doesn't exceed balance
  const balances = await getStacksBalances(config.stxSender);
  const stxBalance = balances.stx.balance;
  if (commitAmount + feeAmount > stxBalance) {
    console.log("commit + fee > balance, recalculating...");
    commitAmount = (stxBalance - feeAmount) / config.numberOfBlocks;
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

async function mineMany(config: any, strategy: any): Promise<any> {
  // loop until target block is reached
  const startMiner = await waitUntilBlock(
    config.targetBlockHeight,
    config.stxSender
  );
  if (startMiner) {
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
    const nonce = await getNonce(config.stxSender);
    // print tx info
    printAddress(config.stxSender);
    console.log(`nonce: ${nonce}`);
    console.log(`commitAmount: ${fromMicro(strategy.commitAmount)} STX`);
    console.log(`numberOfBlocks: ${config.numberOfBlocks}`);
    console.log(`commitTotal: ${fromMicro(strategy.commitTotal)} STX`);
    console.log(`feeAmount: ${fromMicro(strategy.feeAmount)} STX`);
    // create the mining tx
    const txOptions = {
      contractAddress: config.contractAddress,
      contractName: config.contractName,
      functionName: "mine-many",
      functionArgs: [mineManyArrayCV],
      senderKey: config.stxPrivateKey,
      fee: parseInt(strategy.feeAmount),
      nonce: nonce,
      postConditionMode: PostConditionMode.Deny,
      postConditions: [
        makeStandardSTXPostCondition(
          config.stxSender,
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
    // submit tx
    try {
      const transaction = await makeContractCall(txOptions);
      const broadcastResult = await broadcastTransaction(
        transaction,
        STACKS_NETWORK
      );
      console.log("pausing 15sec after submit...");
      await sleep(15000);
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
        return await mineMany(config, strategy);
      }
    } catch (err) {
      exitError(String(err));
    }
  }
}

async function main() {
  disclaimerIntro(
    "Mine Many",
    "Builds and submits mine-many transactions for CityCoins on Stacks with advanced options including continuous mining and automatic commit/fee calculations.",
    true
  );
  const config = await setUserConfig();
  const strategy = await setStrategy(config);
  await mineMany(config, strategy);
  printDivider();
  exitSuccess("all actions complete, script exiting...");
}

main();
