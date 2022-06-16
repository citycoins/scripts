import "cross-fetch/polyfill";
import prompts from "prompts";
import {
  cancelPrompt,
  debugLog,
  disclaimerIntro,
  exitError,
  exitSuccess,
  fromMicro,
  printDivider,
  waitUntilBlock,
} from "../lib/utils";
import { getNonce, getStacksBlockHeight, STACKS_NETWORK } from "../lib/stacks";
import { getCCBalance } from "../lib/citycoins";
import { validateStacksAddress } from "micro-stacks/crypto";
import {
  PostConditionMode,
  makeStandardFungiblePostCondition,
  FungibleConditionCode,
  createAssetInfo,
  makeContractCall,
  SignedContractCallOptions,
  AnchorMode,
  broadcastTransaction,
} from "micro-stacks/transactions";

// set default fee to save time/prompts
const DEFAULT_FEE = 100000; // 0.1 STX, avg is 0.003 STX

export async function promptUser() {
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
          break;
        case "NYC":
          answers.contractAddress = "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11";
          answers.contractName = "newyorkcitycoin-core-v2";
          break;
      }
    }
    if (prompt.name === "startNow" && answer === true) {
      answers.targetBlockHeight = currentBlockHeight;
    }
  };
  printDivider();
  console.log("SET CONFIGURATION");
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
        message: `Set custom fee per TX? (default: ${fromMicro(
          DEFAULT_FEE
        )} STX)`,
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

export async function setStrategy(config: any) {
  printDivider();
  console.log("SET STRATEGY");
  printDivider();

  // if custom commit, confirm commit amount
  // else prompt for distance, percentage, max per block, confirm max per block

  // if custom fee, confirm fee amount
  // else prompt for multiplier, max fee per tx, confirm max fee
}

export async function mineMany(config: any, strategy: any) {
  debugLog("CONFIG");
  debugLog(JSON.stringify(config));
  debugLog("STRATEGY");
  debugLog(JSON.stringify(strategy));
  printDivider();
  console.log("NEXT STEP");
  printDivider();
  // get nonce
  const nonce = await getNonce(config.stxSender);
  console.log(`nonce: ${nonce}`);
  // loop until target block is reached
  const startMiner = await waitUntilBlock(
    config.targetBlockHeight,
    config.stxSender
  );
  startMiner && exitSuccess("Graceful end of function, exiting...");
}

disclaimerIntro(
  "Mine Many",
  "Builds and submits mine-many transactions for CityCoins on Stacks with advanced options including continuous mining.",
  true
);

promptUser().then((config) => {
  const strategy = setStrategy(config);
  mineMany(config, strategy);
});
