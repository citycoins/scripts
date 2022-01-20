import BN from "bn.js";
import prompts from "prompts";
import {
  getBlockHeight,
  getBlockCommit,
  getStxBalance,
  printDivider,
  printTimeStamp,
  processTx,
  timer,
  USTX,
  waitUntilBlock,
  warn,
  title,
  exitWithError,
  getOptimalFee,
  getNonce,
  STACKS_NETWORK,
  cancelPrompt,
  promptFeeStrategy,
} from "./utils.js";
import {
  uintCV,
  listCV,
  PostConditionMode,
  makeStandardSTXPostCondition,
  FungibleConditionCode,
  makeContractCall,
  broadcastTransaction,
} from "@stacks/transactions";

/** @module AutoMiner */

/**
 * @async
 * @function promptUserConfig
 * @description Prompts the user for configuration options at the start of the script
 * @returns {Object[]} An object that contains properties for each question name and related answers as a values
 */
async function promptUserConfig() {
  const currentBlockHeight = await getBlockHeight().catch((err) =>
    exitWithError(`getBlockHeight err: ${err}`)
  );
  const questions = [
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
      name: "stxAddress",
      message: "Stacks Address to mine with?",
      validate: (value) => (value === "" ? "Stacks address is required" : true),
    },
    {
      type: "password",
      name: "stxPrivateKey",
      message: "Private Key for Stacks Address?",
      validate: (value) =>
        value === "" ? "Stacks private key is required" : true,
    },
    {
      type: "confirm",
      name: "autoMine",
      message: "Continuously mine with full STX balance?",
    },
    {
      type: (prev) => (prev ? "confirm" : null),
      name: "autoMineConfirm",
      message: "Confirm mining with full STX balance?",
    },
    {
      type: (prev) => (!prev ? "number" : null),
      name: "numberOfRuns",
      message: "Number of mining TX to send?",
      validate: (value) => {
        if (value < 1) return "Value must be 1 or greater";
        return true;
      },
    },
    {
      type: "number",
      name: "numberOfBlocks",
      message: "Number of blocks to mine per TX? (1-200)",
      validate: (value) =>
        value < 1 || value > 200 ? "Value must be between 1 and 200" : true,
    },
    {
      type: "confirm",
      name: "startNow",
      message: "Start mining now?",
      initial: true,
    },
    {
      type: (prev) => (!prev ? "number" : null),
      name: "targetBlockHeight",
      message: `Target block height? (current: ${currentBlockHeight})`,
      validate: (value) =>
        value < currentBlockHeight
          ? `Value must be equal to or greater than current block height: ${currentBlockHeight}`
          : true,
    },
    {
      type: "confirm",
      name: "customCommit",
      message: "Set custom block commit?",
    },
    {
      type: (prev) => (prev ? "number" : null),
      name: "customCommitValue",
      message: "Custom block commit value in uSTX? (1,000,000 uSTX = 1 STX)",
      validate: (value) => (value > 0 ? true : "Value must be greater than 0"),
    },
    {
      type: "confirm",
      name: "customFee",
      message: "Set custom fee?",
    },
    {
      type: (prev) => (prev ? "number" : null),
      name: "customFeeValue",
      message: "Custom fee value in uSTX? (1,000,000 uSTX = 1 STX)",
      validate: (value) => (value > 0 ? true : "Value must be greater than 0"),
    },
  ];
  const submit = (prompt, answer, answers) => {
    if (prompt.name === "citycoin") {
      switch (answer) {
        case "MIA":
          answers.contractAddress = "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27";
          answers.contractName = "miamicoin-core-v1";
          break;
        case "NYC":
          answers.contractAddress = "SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5";
          answers.contractName = "newyorkcitycoin-core-v1";
          break;
      }
    }
  };
  const userConfig = await prompts(questions, {
    onCancel: cancelPrompt,
    onSubmit: submit,
  });
  return userConfig;
}

/**
 * @async
 * @function promptMiningStrategy
 * @description Prompts the user for a custom mining strategy
 * @returns {Object[]} An object that contains properties for each question name and related answers as a values
 */
async function promptMiningStrategy() {
  // configure mining strategy
  const miningStrategyQuestions = [
    {
      type: "number",
      name: "strategyDistance",
      message: "Number of blocks to search for strategy?",
      validate: (value) => {
        if (value < 1 || value > 100) return "Value must be between 1 and 100";
        return true;
      },
    },
    {
      type: "number",
      name: "targetPercentage",
      message: "Target percentage of total block commit?",
      validate: (value) => {
        if (value === "") return "Target percentage is required";
        if (value < 1 || value > 100) return "Value must be between 1 and 100";
        return true;
      },
    },
    {
      type: "number",
      name: "maxCommitBlock",
      message: "Max commit per block in uSTX? (1,000,000 uSTX = 1 STX)",
    },
  ];
  const miningStrategy = await prompts(miningStrategyQuestions, {
    onCancel: cancelPrompt,
  });
  // verify max commit set by user or exit
  const confirmMax = await prompts(
    {
      type: "confirm",
      name: "confirmMax",
      message: `Confirm max commit: ${(
        miningStrategy.maxCommitBlock / USTX
      ).toFixed(6)} STX?`,
    },
    {
      onCancel: cancelPrompt,
    }
  );
  if (!confirmMax) {
    exitWithError("ERROR: max commit not confirmed, exiting...");
  }
  // return miningStrategy object
  return miningStrategy;
}

/**
 * @async
 * @function autoMine
 * @param {Object[]} userConfig An object that contains properties for each question name and related answers as a values
 * @param {Object[]} [miningStrategy={}] An object that contains properties for automatically calculating a commit
 * @param {boolean} [firstRun=true] A boolean that indicates if this is the first run of the script
 * @description Builds and submits a mining transaction based on the provided user configuration and mining strategy
 */
async function autoMine(userConfig, miningStrategy = {}, firstRun = true) {
  // set initial variables
  let commit = 0;
  let maxCommitBalance = 0;
  let targetFee = 0;
  let feeMultiplier = [];

  // set number of runs, 0 if continuous
  const numberOfRuns =
    userConfig.autoMine && userConfig.autoMineConfirm
      ? 0
      : userConfig.numberOfRuns;

  if (userConfig.startNow && firstRun === true) {
    // set block height to start tx on first run
    userConfig.targetBlockHeight = await getBlockHeight().catch((err) =>
      exitWithError(`getBlockHeight err: ${err}`)
    );
  }

  if (userConfig.customCommit) {
    if (firstRun) {
      // prompt user to confirm custom commit
      const confirmCommit = await prompts(
        {
          type: "confirm",
          name: "confirmCommit",
          message: `Confirm custom commit: ${(
            userConfig.customCommitValue / USTX
          ).toFixed(6)} STX`,
        },
        {
          onCancel: cancelPrompt,
        }
      );
      // exit if not confirmed
      if (!confirmCommit) {
        exitWithError("ERROR: custom commit not confirmed, exiting...");
      }
    }
    // set custom commit value
    commit = userConfig.customCommitValue;
  } else {
    // check if strategy already exists and if not set it
    if (
      !miningStrategy.hasOwnProperty("strategyDistance") &&
      !miningStrategy.hasOwnProperty("targetPercentage") &&
      !miningStrategy.hasOwnProperty("maxCommitBlock")
    ) {
      printDivider();
      console.log(title("STATUS: SETTING MINING STRATEGY"));
      printDivider();
      miningStrategy = await promptMiningStrategy();
    }
  }

  if (userConfig.customFee) {
    if (firstRun) {
      // verify custom fee set by user or exit
      const confirmFee = await prompts(
        {
          type: "confirm",
          name: "confirmFee",
          message: `Confirm custom fee: ${(
            userConfig.customFeeValue / USTX
          ).toFixed(6)} STX`,
        },
        {
          onCancel: cancelPrompt,
        }
      );
      if (!confirmFee) {
        exitWithError("ERROR: custom fee not confirmed, exiting...");
      }
    }
    targetFee = userConfig.customFeeValue;
  } else {
    // check if fee multiplier exists and if not set it
    if (!miningStrategy.hasOwnProperty("feeMultiplier")) {
      feeMultiplier = await promptFeeStrategy();
      miningStrategy.feeMultiplier = feeMultiplier.value;
    }
  }

  // loop until target block is reached
  const startMiner = await waitUntilBlock(userConfig);

  if (startMiner) {
    // output address and summary info
    printDivider();
    console.log(title("STATUS: BUILDING MINING TX"));
    printDivider();
    printTimeStamp();
    console.log(
      `account: ${userConfig.stxAddress.slice(
        0,
        5
      )}...${userConfig.stxAddress.slice(userConfig.stxAddress.length - 5)}`
    );
    const stxBalance = await getStxBalance(userConfig.stxAddress).catch((err) =>
      exitWithError(`getStxBalance err: ${err}`)
    );
    console.log(`balance: ${(stxBalance / USTX).toFixed(6)} STX`);
    console.log(
      `mining runs: ${userConfig.autoMineConfirm ? "infinite" : numberOfRuns}`
    );
    console.log(`mining ${userConfig.numberOfBlocks} blocks per TX`);

    // output commit info and calculate if needed
    printDivider();
    if (userConfig.customCommit) {
      console.log(title("STATUS: CUSTOM COMMIT SET"));
      printDivider();
      console.log(`customCommit: ${(commit / USTX).toFixed(6)} STX`);
    } else {
      console.log(title("STATUS: CALCULATING COMMIT"));
      printDivider();
      commit = await getBlockCommit(userConfig, miningStrategy).catch((err) =>
        exitWithError(`getBlockCommit err: ${err}`)
      );
      if (commit > miningStrategy.maxCommitBlock) {
        console.log(
          warn(
            `WARNING: commit of ${(commit / USTX).toFixed(
              6
            )} STX is greater than max threshold of ${(
              miningStrategy.maxCommitBlock / USTX
            ).toFixed(6)}`
          )
        );
        console.log(
          `setting commit to ${(miningStrategy.maxCommitBlock / USTX).toFixed(
            6
          )} STX`
        );
        commit = miningStrategy.maxCommitBlock;
      }
    }

    // compare commit value to balance
    maxCommitBalance = parseInt(stxBalance / userConfig.numberOfBlocks);
    if (commit > maxCommitBalance) {
      console.log(
        warn(
          `WARNING: commit of ${(commit / USTX).toFixed(
            6
          )} STX is greater than balance`
        )
      );
      console.log(
        `setting commit to ${(maxCommitBalance / USTX).toFixed(6)} STX`
      );
      commit = maxCommitBalance;
    }

    // output commit calculations
    printDivider();
    if (!userConfig.customCommit) {
      console.log(`target: ${miningStrategy.targetPercentage}%`);
      console.log(
        `maxPerBlock: ${(miningStrategy.maxCommitBlock / USTX).toFixed(6)} STX`
      );
    }
    console.log(`maxPerBalance: ${(maxCommitBalance / USTX).toFixed(6)} STX`);
    console.log(`commit: ${(commit / USTX).toFixed(6)} STX`);

    // output fee info and calculate if needed
    printDivider();
    if (userConfig.customFee) {
      console.log(title("STATUS: CUSTOM FEE SET"));
      printDivider();
      console.log(`customFee: ${(targetFee / USTX).toFixed(6)} STX`);
    } else {
      console.log(title("STATUS: CALCULATING FEES"));
      printDivider();
      targetFee = await getOptimalFee(miningStrategy.feeMultiplier).catch(
        (err) => exitWithError(`getOptimalFee err: ${err}`)
      );
      console.log(`targetFee: ${(targetFee / USTX).toFixed(6)} STX`);
    }

    // check that total commit + fee is not higher than the balance
    if (commit * userConfig.numberOfBlocks + targetFee >= stxBalance) {
      console.log(
        warn(
          `WARNING: commit of ${(commit / USTX).toFixed(6)} STX + fee of ${(
            targetFee / USTX
          ).toFixed(6)} STX is greater than balance`
        )
      );
      console.log(`subtracting fee from commit per block`);
      commit -= parseInt(targetFee / userConfig.numberOfBlocks);
      console.log(`newCommit: ${(commit / USTX).toFixed(6)} STX`);
    }

    printDivider();
    console.log(title("STATUS: SUBMITTING MINING TX"));
    printDivider();

    // get the current nonce
    const nonce = await getNonce(userConfig.stxAddress).catch((err) =>
      exitWithError(`getNonce err: ${err}`)
    );
    let mineManyArray = [];

    // create the clarity values for the mining tx
    for (let i = 0; i < userConfig.numberOfBlocks; i++) {
      mineManyArray.push(uintCV(commit));
    }
    const sumCV = uintCV(commit * userConfig.numberOfBlocks);
    mineManyArray = listCV(mineManyArray);

    console.log(
      `account: ${userConfig.stxAddress.slice(
        0,
        5
      )}...${userConfig.stxAddress.slice(userConfig.stxAddress.length - 5)}`
    );
    console.log(`nonce: ${nonce}`);
    console.log(
      `totalCommit: ${((commit * userConfig.numberOfBlocks) / USTX).toFixed(
        6
      )} STX`
    );

    // create the mining tx
    const txOptions = {
      contractAddress: userConfig.contractAddress,
      contractName: userConfig.contractName,
      functionName: "mine-many",
      functionArgs: [mineManyArray],
      senderKey: userConfig.stxPrivateKey,
      fee: new BN(targetFee),
      nonce: new BN(nonce),
      postConditionMode: PostConditionMode.Deny,
      postConditions: [
        makeStandardSTXPostCondition(
          userConfig.stxAddress,
          FungibleConditionCode.Equal,
          sumCV.value
        ),
      ],
      network: STACKS_NETWORK,
    };

    // pause 10sec
    console.log(`pausing 10sec before submit`);
    await timer(10000);

    // submit the tx
    const transaction = await makeContractCall(txOptions).catch((err) =>
      exitWithError(`makeContractCall err: ${err}`)
    );
    const result = await broadcastTransaction(
      transaction,
      STACKS_NETWORK
    ).catch((err) => exitWithError(`broadcastTransaction err: ${err}`));

    // monitor the tx status
    const processTxBlock = await processTx(result, transaction.txid()).catch(
      (err) => exitWithError(`processTx err: ${err}`)
    );

    // check if AutoMiner should restart with new value
    if (userConfig.autoMineConfirm === true || userConfig.numberOfRuns > 0) {
      userConfig.numberOfRuns -= 1;
      userConfig.targetBlockHeight = processTxBlock + userConfig.numberOfBlocks;
      printDivider();
      console.log(title("STATUS: RESTARTING WITH NEW TARGET"));
      printDivider();
      console.log(`newTarget: ${userConfig.targetBlockHeight}`);
      autoMine(userConfig, miningStrategy, false);
    } else {
      exitWithError("Selected number of runs complete, exiting...");
    }
  } else {
    exitWithError("ERROR: unable to start miner, exiting...");
  }
}

// show title and disclaimer on first run
printDivider();
console.log(title("CITYCOINS AUTOMINER"));
printDivider();
console.log(
  "This utility will build a CityCoin mining transaction and submit it to the blockchain, with options to set an automated or custom strategy, as well as the ability to mine continuously.\n"
);
console.log(
  "THIS IS ALPHA SOFTWARE THAT REQUIRES A STACKS PRIVATE KEY TO SEND A TRANSACTION.\n"
);
console.log("THE CODE IS FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY.\n");
console.log(warn("USE AT YOUR OWN RISK. PLEASE REPORT ANY ISSUES ON GITHUB."));

// get the user config and start the AutoMiner
printDivider();
console.log(title("STATUS: SETTING USER CONFIG"));
printDivider();
promptUserConfig().then((answers) => autoMine(answers));
