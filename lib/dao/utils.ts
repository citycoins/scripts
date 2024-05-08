import prompts from "prompts";
import throttledQueue from "throttled-queue";

/* CONFIGURATION */

// set true to enable verbose logging
const ENABLE_LOGS = false;

/* GENERAL UTILITIES */

// exit with message and status code
export function exitSuccess(msg: string): never {
  console.log(`SUCCESS: ${msg}, exiting...`);
  process.exit(0);
}

export function exitError(msg: string): never {
  console.log(`ERROR: ${msg}, exiting...`);
  process.exit(1);
}

// replacer for BigInt inside of JSON.stringify()
export function fixBigInt(key: any, value: any) {
  return typeof value === "bigint" ? value.toString() + "n" : value;
}

// sometime's it's great to take a pause
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* CONVERSION UTILITIES */

export function toMicro(amount: number, decimals = 6) {
  return amount * 10 ** decimals;
}

export function fromMicro(amount: number, decimals = 6) {
  return (amount / 10 ** decimals).toFixed(decimals);
}

/* FETCH UTILITIES */

// throttle to 1 request per second
const throttle = throttledQueue(1, 1000, true);

export async function fetchJson(url: string) {
  debugLog(`fetchJson: fetching ${url}`);
  const response = await throttle(() => fetch(url));
  if (response.status === 200) {
    const contentType = response.headers.get("content-type");
    console.log(`contentType: ${contentType}`);
    const text = await response.text();
    //console.log(`text: ${text}`);
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  throw new Error(
    `fetchJson: ${url} ${response.status} ${response.statusText}`
  );
}

/* PRINT UTILITIES */

// general intro and disclaimer for all scripts
export function printIntro(
  title: string,
  description: string,
  keyRequired: boolean
) {
  console.log(`\n===== ${title.toUpperCase()} =====\n`);
  console.log(`${description}\n`);
  keyRequired &&
    console.log(
      "THIS IS ALPHA SOFTWARE THAT REQUIRES A STACKS PRIVATE KEY TO SEND A TRANSACTION.\n"
    );
  console.log("THE CODE IS FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY.\n");
  console.log("USE AT YOUR OWN RISK. PLEASE REPORT ANY ISSUES ON GITHUB.");
}

export function log(msg: string) {
  console.log(msg);
}

export function debugLog(msg: string) {
  ENABLE_LOGS && console.log(`DEBUG: ${msg}`);
}

export function printDivider() {
  console.log(`------------------------------`);
}

export function printTimeStamp() {
  let newDate = new Date().toLocaleString();
  newDate = newDate.replace(/,/g, "");
  console.log(newDate);
}

export function printAddress(
  address: string,
  shorten?: boolean,
  numChars?: number
) {
  if (!numChars) numChars = 5;
  if (shorten)
    address = `${address.slice(0, numChars)}...${address.slice(-numChars)}`;
  console.log(`address: ${address}`);
}

export function printAmount(amount: number, symbol: string, decimals?: number) {
  if (!decimals) decimals = 6;
  console.log(`amount: ${amount.toFixed(decimals)} ${symbol}`);
}

/* PROMPT UTILITIES */

export function onCancel(prompt: prompts.PromptObject<string>) {
  exitError(`cancelled at ${prompt.name}, exiting...`);
}

export async function confirmByPrompt(message: string) {
  const confirmation = await prompts(
    {
      type: "toggle",
      name: "value",
      message,
      initial: false,
      active: "Yes",
      inactive: "No",
    },
    { onCancel }
  );
  return confirmation.value;
}
