import fetch from "node-fetch";
import throttledQueue from "throttled-queue";

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
export async function waitUntilBlock(block: number): Promise<boolean> {
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
