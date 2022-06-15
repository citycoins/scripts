import fetch from "node-fetch";
import throttledQueue from "throttled-queue";
import { getStacksBlockHeight, getTotalMempoolTx } from "./stacks";

// debug settings for more verbose logging
const ENABLE_LOGS = false;
export const debugLog = (msg: string) =>
  ENABLE_LOGS && console.log(`DEBUG: ${msg}`);

// output helpers
export const printDivider = () => console.log(`------------------------------`);
export const printTimeStamp = () => {
  let newDate = new Date().toLocaleDateString();
  newDate = newDate.replace(/,/g, "");
  console.log(newDate);
};

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

// throttle to 4 requests per second
const throttle = throttledQueue(4, 1000, true);

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
    console.log(`STATUS: WAITING FOR TARGET BLOCK ${block.toLocaleString()}`);
    printDivider();
    printTimeStamp();
    console.log(`account: ${address.slice(0, 5)}...${address.slice(-5)}`);
    // get current block
    currentBlock = await getStacksBlockHeight().catch((err) => exitError(err));
    console.log(`currentBlock: ${currentBlock.toLocaleString()}`);
    console.log(`targetBlock: ${block.toLocaleString()}`);
    // show distance and time
    if (currentBlock < block) {
      console.log(
        `distance: ${(block - currentBlock).toLocaleString()} blocks to go`
      );
      const remainingTime = ((block - currentBlock) * 10) / 60;
      remainingTime >= 1
        ? console.log(`time: ${remainingTime.toFixed(2)} hours}`)
        : console.log(`time: ${(remainingTime * 60).toFixed()} minutes`);
    }
    // show mempool tx count
    const mempoolTx = await getTotalMempoolTx().catch((err) => exitError(err));
    console.log(`mempoolTx: ${mempoolTx.toLocaleString()}`);
  } while (block > currentBlock);

  return true;
}

// intro and disclaimer
export function disclaimerIntro(
  title: string,
  description: string,
  requiresKey: boolean
): void {
  printDivider();
  console.log(`${title.toUpperCase()}`);
  console.log(description);
  printDivider();
  requiresKey &&
    console.log(
      "THIS IS ALPHA SOFTWARE THAT REQUIRES A STACKS PRIVATE KEY TO SEND A TRANSACTION.\n"
    );
  console.log("THE CODE IS FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY.\n");
  console.log("USE AT YOUR OWN RISK. PLEASE REPORT ANY ISSUES ON GITHUB.");
}
