import BN from "bn.js";
import console from "console";
import prompts from "prompts";
import {
  cancelPrompt,
  exitWithError,
  getCityCoinBalance,
  printDivider,
  title,
  warn,
} from "./utils.js";

/** @module AutoStacker */

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
      message: "Select a CityCoin to Stack:",
      choices: [
        { title: "MiamiCoin (MIA)", value: "MIA" },
        { title: "NewYorkCityCoin (NYC)", value: "NYC" },
      ],
    },
    {
      type: "text",
      name: "stxAddress",
      message: "Stacks Address to Stack with?",
      validate: (value) => (value === "" ? "Stacks address is required" : true),
    },
    {
      type: "password",
      name: "stxPrivateKey",
      message: "Private Key for Stacks Address?",
      validate: (value) =>
        value === "" ? "Stacks private key is required" : true,
    },
  ];
  const submit = (prompt, answer, answers) => {
    if (prompt.name === "citycoin") {
      switch (answer) {
        case "MIA":
          answers.contractAddress = "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27";
          answers.contractName = "miamicoin-core-v1";
          answers.contractToken = "miamicoin-token";
          answers.tokenSymbol = "MIA";
          break;
        case "NYC":
          answers.contractAddress = "SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5";
          answers.contractName = "newyorkcitycoin-core-v1";
          answers.contractToken = "newyorkcitycoin-token";
          answers.tokenSymbol = "NYC";
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
 * @function promptStackingStrategy
 * @description Prompts the user for a stacking information
 * @returns {Object[]} An object that contains properties for each question name and related answers as a values
 */
async function promptStackingStrategy(userConfig) {
  const balance = await getCityCoinBalance(
    userConfig.contractAddress,
    userConfig.contractToken,
    userConfig.stxAddress
  );

  if (balance === 0) {
    exitWithError("No CityCoin balance to Stack, exiting...");
  }

  // configure Stacking strategy
  const stackingStrategyQuestions = [
    {
      type: "number",
      name: "amountTokens",
      message: `Number of CityCoins to Stack? (balance: ${balance.toLocaleString()} ${
        userConfig.tokenSymbol
      })`,
      validate: (value) => (value > 0 ? true : "Amount must be greater than 0"),
    },
    {
      type: "number",
      name: "lockPeriod",
      message: "Number of cycles to Stack? (1 cycle = ~2 weeks)",
      validate: (value) => {
        if (value === "") return "Target percentage is required";
        if (value < 1 || value > 32) return "Value must be between 1 and 32";
        return true;
      },
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
  const stackingStrategy = await prompts(stackingStrategyQuestions, {
    onCancel: cancelPrompt,
  });
  // return stackingStrategy object
  return stackingStrategy;
}

async function autoStack(userConfig) {
  let targetFee = 0;
  const stackingStrategy = await promptStackingStrategy(userConfig);
}

// show title and disclaimer on first run
printDivider();
console.log(title("CITYCOINS AUTOSTACKER"));
printDivider();
console.log(
  "This utility will build a CityCoin stacking transaction and submit it to the blockchain.\n"
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
promptUserConfig().then((answers) => autoStack(answers));
