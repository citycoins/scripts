import console from "console";
import prompts from "prompts";
import {
  exitWithError,
  getBlockHeight,
  getRewardCycle,
  getStackerAtCycleOrDefault,
  getUserId,
  printDivider,
  printTimeStamp,
} from "./utils.js";

/** @module GetStackingInfo */

/**
 * @async
 * @function promptUserConfig
 * @description Prompts the user for configuration options at the start of the script
 * @returns {Object[]} An object that contains properties for each question name and related answers as a values
 */
async function promptUserConfig() {
  const questions = [
    {
      type: "select",
      name: "citycoin",
      message: "Select a CityCoin to look up stacking info:",
      choices: [
        { title: "MiamiCoin (MIA)", value: "MIA" },
        { title: "NewYorkCityCoin (NYC)", value: "NYC" },
      ],
    },
    {
      type: "text",
      name: "stxAddress",
      message: "Stacks Address to search for?",
      validate: (value) => (value === "" ? "Stacks address is required" : true),
    },
    {
      type: "confirm",
      name: "searchAllCycles",
      message: "Search all cycles?",
      initial: true,
    },
    {
      type: (prev) => (prev === true ? null : "number"),
      name: "targetCycle",
      message: "Target cycle?",
      validate: (value) => (value === "" ? "Target cycle is required" : true),
    },
  ];
  const submit = (prompt, answer, answers) => {
    if (prompt.name === "citycoin") {
      switch (answer) {
        case "MIA":
          answers.contractAddress = "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27";
          answers.contractName = "miamicoin-core-v1";
          answers.tokenSymbol = "MIA";
          break;
        case "NYC":
          answers.contractAddress = "SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5";
          answers.contractName = "newyorkcitycoin-core-v1";
          answers.tokenSymbol = "NYC";
          break;
      }
    }
  };
  const cancel = (prompt) => {
    exitWithError(`ERROR: cancelled by user at ${prompt.name}, exiting...`);
  };
  const userConfig = await prompts(questions, {
    onCancel: cancel,
    onSubmit: submit,
  });
  return userConfig;
}

/**
 * @async
 * @function getStackingInfo
 * @description Displays a table with the stacking info for a given Stacks address
 */
async function getStackingInfo() {
  const stackingStats = [];
  const maxCycles = 32;

  const userConfig = await promptUserConfig().catch((err) =>
    exitWithError(`promptUserConfig err: ${err}`)
  );

  printDivider();
  printTimeStamp();

  const currentBlockHeight = await getBlockHeight().catch((err) =>
    exitWithError(`getBlockHeight err: ${err}`)
  );
  console.log(`currentBlockHeight: ${currentBlockHeight}`);

  const currentCycle = await getRewardCycle(
    userConfig.contractAddress,
    userConfig.contractName,
    currentBlockHeight
  ).catch((err) => exitWithError(`getRewardCycle err: ${err}`));
  console.log(`currentCycle: ${currentCycle}`);

  const userId = await getUserId(
    userConfig.contractAddress,
    userConfig.contractName,
    userConfig.stxAddress
  ).catch((err) => exitWithError(`getUserId err: ${err}`));
  console.log(`UserId: ${userId}`);

  printDivider();

  if (userConfig.searchAllCycles) {
    console.log(`Checking cycles 1 to ${currentCycle + maxCycles}...`);
    let i = 0;
    do {
      const stacker = await getStackerAtCycleOrDefault(
        userConfig.contractAddress,
        userConfig.contractName,
        i + 1,
        userId
      );
      stackingStats.push({
        CityCoin: userConfig.tokenSymbol,
        Cycle: i + 1,
        amountStacked: parseInt(stacker.value.amountStacked.value),
        toReturn: parseInt(stacker.value.toReturn.value),
      });
      if (i > currentCycle) {
        if (parseInt(stacker.value.amountStacked.value) === 0) {
          console.log(`Stopping at cycle ${i + 1} due to 0 amount stacked`);
          break;
        }
      }
      i++;
    } while (i < currentCycle + maxCycles);
  } else {
    console.log(`Checking cycle ${userConfig.targetCycle}...`);
    const stacker = await getStackerAtCycleOrDefault(
      userConfig.contractAddress,
      userConfig.contractName,
      userConfig.targetCycle,
      userId
    );
    stackingStats.push({
      CityCoin: userConfig.tokenSymbol,
      Cycle: userConfig.targetCycle,
      amountStacked: parseInt(stacker.value.amountStacked.value),
      toReturn: parseInt(stacker.value.toReturn.value),
    });
  }

  console.table(stackingStats);
}

getStackingInfo();
