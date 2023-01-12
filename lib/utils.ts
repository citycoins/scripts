import fetch from "node-fetch";
import prompts from "prompts";
import throttledQueue from "throttled-queue";
import {
  getChildAccount,
  getChildAccounts,
  getStacksBlockHeight,
  getTotalMempoolTx,
} from "./stacks";

// debug settings for more verbose logging
// TODO/IDEA: debugLog could accept a "level" integer
// default to info if nothing specified
// 1: errors ERROR:
// 2: warnings WARN:
// 3: info INFO:
// Could also split into categories or file names.
const ENABLE_LOGS = false;
export const debugLog = (msg: string) =>
  ENABLE_LOGS && console.log(`DEBUG: ${msg}`);

// micro helpers
export const MICRO_UNITS = 1000000;
export const toMicro = (amount: number) => amount * MICRO_UNITS;
export const fromMicro = (amount: number) => (amount / MICRO_UNITS).toFixed(6);

// output helpers
export const printDivider = () => console.log(`------------------------------`);
export const printTimeStamp = () => {
  let newDate = new Date().toLocaleString();
  newDate = newDate.replace(/,/g, "");
  console.log(newDate);
};
export const printAddress = (address: string) =>
  console.log(`address: ${address.slice(0, 5)}...${address.slice(-5)}`);
export const printAmount = (amount: number, symbol: string) =>
  console.log(`amount: ${amount.toFixed(6)} ${symbol}`);

// catch user exiting the prompt interface
export const cancelPrompt = (promptName: string) => {
  exitError(`ERROR: cancelled by user at ${promptName}, exiting...`);
};

// exit with status
export const exitSuccess = (msg: string) => {
  console.log(msg);
  process.exit(0);
};
export const exitError = (msg: string) => {
  console.log(msg);
  process.exit(1);
};

// async sleep timer
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// throttle to 1 requests per second
const throttle = throttledQueue(1, 1000, true);

// fetch and return JSON from URL
export const fetchJson = async (url: string): Promise<any> => {
  debugLog(`fetchJson: ${url}`);
  const response = await throttle(() => fetch(url));
  if (response.status === 200) {
    const json = await response.json();
    debugLog(`fetchJson: ${JSON.stringify(json)}`);
    return json;
  }
  throw new Error(
    `fetchJson: ${url} ${response.status} ${response.statusText}`
  );
};

// wait for Stacks block height before continuing
export async function waitUntilBlock(
  block: number,
  address: string
): Promise<boolean> {
  // initial config
  var init = true;
  var currentBlock = 0;
  // loop until target block is reached
  do {
    if (init) {
      init = false;
    } else {
      // pause based on distance to target block
      if (block - currentBlock > 25) {
        // over 25 blocks (4 hours / 240 minutes)
        // check every 2hr
        await sleep(7200000);
      } else if (block - currentBlock > 5) {
        // between 5-25 blocks (50 minutes - 4 hours)
        // check every 30min
        await sleep(1800000);
      } else {
        // less than 5 blocks (50 minutes)
        // check every 5min
        await sleep(300000);
      }
    }
    // print title and info
    printDivider();
    console.log(`WAITING FOR BLOCK ${block}`);
    printDivider();
    printTimeStamp();
    printAddress(address);
    // get current block
    currentBlock = await getStacksBlockHeight().catch((err) => exitError(err));
    console.log(`currentBlock: ${currentBlock}`);
    console.log(`targetBlock: ${block}`);
    // show distance and time
    if (currentBlock < block) {
      console.log(`distance: ${block - currentBlock} blocks left`);
      const remainingTime = ((block - currentBlock) * 10) / 60;
      remainingTime >= 1
        ? console.log(`time: ${remainingTime.toFixed(2)} hours`)
        : console.log(`time: ${(remainingTime * 60).toFixed()} minutes`);
    }
    // show mempool tx count
    const mempoolTx = await getTotalMempoolTx().catch((err) => exitError(err));
    console.log(`mempoolTx: ${mempoolTx}`);
  } while (block > currentBlock);

  return true;
}

// set user config used by all scripts
export async function setUserConfig() {
  printDivider();
  console.log("SETTING USER CONFIGURATION");
  printDivider();
  // prompt for user config
  const userConfig = await prompts(
    [
      {
        type: "select",
        name: "network",
        message: "Select a network:",
        choices: [
          { title: "Mainnet", value: "mainnet" },
          { title: "Testnet", value: "testnet" },
        ],
      },
      {
        type: "select",
        name: "citycoin",
        message: "Select a CityCoin to claim mining rewards:",
        choices: [
          { title: "MiamiCoin (MIA)", value: "MIA" },
          { title: "NewYorkCityCoin (NYC)", value: "NYC" },
        ],
      },
      {
        type: "password",
        name: "stxMnemonic",
        message: "Seed phrase for Stacks address?",
        validate: (value: string) =>
          value === ""
            ? "Stacks seed phrase is required to send a transaction"
            : true,
      },
    ],
    {
      onCancel: (prompt: any) => cancelPrompt(prompt.name),
    }
  );
  return userConfig;
}

export async function setAddressConfig(userConfig: any) {
  printDivider();
  console.log("SETTING ADDRESS CONFIGURATION");
  printDivider();
  // get first 4 addresses from mnemonic
  const { addresses, keys } = await getChildAccounts(userConfig.stxMnemonic, 3);
  const addressChoices = addresses.map((address: string, index: number) => {
    return { title: address, value: index };
  });
  // add an option for specifying a higher index
  addressChoices.push({ title: "Other...", value: -1 });
  const addressConfig = await prompts([
    {
      type: "select",
      name: "stxAccountIndex",
      message: "Select an account listed below:",
      choices: addressChoices,
    },
    {
      type: (prev) => (prev === -1 ? "number" : null),
      name: "stxAccountIndex",
      message: "Enter the desired account index:",
      validate: (value: number) =>
        value < 0 ? "Account index must be greater than 0" : true,
    },
    /* TODO: LEFT OFF HERE
    {
      type: "text",
      name: "stxAddress",
      message: "Please confirm the Stacks address:",
      initial: async (prev) => {
        return await getChildAccount(userConfig.stxMnemonic, prev);
      },
    },
    */
  ]);
  return addressConfig;
}

// intro and disclaimer
export function disclaimerIntro(
  title: string,
  description: string,
  requiresKey: boolean
): void {
  printDivider();
  printDivider();
  console.log(`${title.toUpperCase()}`);
  printDivider();
  printDivider();
  console.log(description);
  printDivider();
  printDivider();
  requiresKey &&
    console.log(
      "THIS IS ALPHA SOFTWARE THAT REQUIRES A STACKS PRIVATE KEY TO SEND A TRANSACTION.\n"
    );
  console.log("THE CODE IS FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY.\n");
  console.log("USE AT YOUR OWN RISK. PLEASE REPORT ANY ISSUES ON GITHUB.");
  printDivider();
}
