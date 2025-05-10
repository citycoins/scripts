import {
  AddressTransactionsWithTransfersListResponse,
  BlockListResponse,
  ContractCallTransaction,
  Transaction,
} from "@stacks/stacks-blockchain-api-types";
import { mkdir, readFile, writeFile } from "fs/promises";
import { callReadOnlyFunction } from "micro-stacks/api";
import {
  principalCV,
  SomeCV,
  TupleCV,
  UIntCV,
  uintCV,
} from "micro-stacks/clarity";
import { StacksMainnet } from "micro-stacks/network";

//////////////////////////////////////////////////
//
// CCIP-016 Calculation Script
// Downloads all transactions and performs analysis for CCIP-016
// Designed to run and produce independently verifiable results
// https://github.com/citycoins/governance/pull/16
//
//////////////////////////////////////////////////

//////////////////////////////////////////////////
//
// CONFIGURATION
// Constants and configuration for the script.
//
//////////////////////////////////////////////////

// set API base urls
export const hiroApiBase = "https://api.mainnet.hiro.so";
const ccApiBase = "https://protocol.citycoins.co/api";
const network = new StacksMainnet({ url: hiroApiBase });

// endpoint to get first bitcoin block in cycle
// expects query param cycle
const firstBlockEndpoint =
  "/ccd007-citycoin-stacking/get-first-block-in-reward-cycle";

// endpoint to get stacks block for bitcoin block
const btcToStxEndpoint = "/extended/v2/burn-blocks";

// start and end taken from CCIP-020
// https://github.com/citycoins/governance/blob/feat/add-ccip-022/ccips/ccip-020/ccip-020-graceful-protocol-shutdown.md
const startCycle = 54;
const endCycle = 83;

// file path for cycle data
const cycleFilePath = "./results/ccip016-cycle-data.json";

// maximum number of retries for fetching data
const maxFetchRetries = 3;

// 6 decimals for Stacks
const stxDecimals = 10 ** 6;

//////////////////////////////////////////////////
//
// Data structures
// Objects to store the data for analysis
//
//////////////////////////////////////////////////

// object to store the cycle data
// this needs to include start/end BTC heights (since STX isn't 100% 1:1)
interface CycleData {
  [key: number]: {
    // key: cycle number
    btcStartHeight: number | null;
    btcEndHeight: number | null;
    stxStartHeight: number | null;
    stxEndHeight: number | null;
  };
}

// object to store the payout data
// derived from the CCD011 transactions
export interface PayoutData {
  [key: number]: {
    // key: cycle number
    tx: ContractCallTransaction[];
    miaPayoutAmount: number | null;
    miaPayoutCycle: number | null;
    miaPayoutHeight: number | null;
    miaPayoutHeightDiff: number | null;
    nycPayoutAmount: number | null;
    nycPayoutCycle: number | null;
    nycPayoutHeight: number | null;
    nycPayoutHeightDiff: number | null;
  };
}

// object to store the missed payout transactions
export interface MissedPayouts {
  [key: number]: {
    mia: { userStackingStats: number; tx: ContractCallTransaction }[];
    nyc: { userStackingStats: number; tx: ContractCallTransaction }[];
  };
}

//////////////////////////////////////////////////
//
// Helper functions
// Tools and logic reused elsewhere in the script.
//
//////////////////////////////////////////////////

/**
 * Display a microSTX amount in STX.
 * @param stx The microSTX amount.
 * @returns The STX amount as a string divided by set decimals.
 */
function displayMicro(stx: number) {
  return `${(stx / stxDecimals).toLocaleString("en-US", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
    useGrouping: true,
  })} STX`;
}

/**
 * Asynchronous sleep function.
 * @param ms The number of milliseconds to sleep.
 */
async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fancy fetch function that retries on failure.
 * @param url The URL to fetch from.
 * @param json Whether to parse the response as JSON or text.
 * @param retries (default: 3) The maximum number of retries to attempt.
 * @param attempts (default: 1) The current attempt number.
 * @returns The response data with the provided type T.
 */
async function fancyFetch<T>(
  url: string,
  json = true,
  retries = maxFetchRetries,
  attempts = 1
): Promise<T> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch from ${url}: ${response.status}, ${response.statusText}`
      );
    }
    const responseData: T = json
      ? await response.json()
      : await response.text();
    return responseData;
  } catch (error) {
    if (attempts < retries) {
      console.log(`(${attempts}) Retrying fetch in 5 seconds... (${error})`);
      await sleep(5000);
      return fancyFetch(url, json, retries, attempts + 1);
    } else {
      throw error;
    }
  }
}

/**
 * Check if given error object is a NodeJS error.
 * @param error the error object.
 * @returns if given error object is a NodeJS error.
 */
const isNodeError = (error: Error): error is NodeJS.ErrnoException =>
  error instanceof Error;

/**
 * Print a consistent divider to the console.
 */
function printDivider() {
  console.log("-------------------------");
}

/**
 * Get the contents of a file.
 * @param path the path to the file.
 * @returns fileData if found, null if file not found, or throws an error.
 */
async function getFile(path: string) {
  try {
    const fileData = await readFile(path, "utf-8");
    return fileData;
  } catch (error) {
    if (
      error instanceof Error &&
      isNodeError(error) &&
      error.code === "ENOENT"
    ) {
      return null;
    } else {
      throw error;
    }
  }
}

//////////////////////////////////////////////////
//
// Transactions
// Functions to prepare and download transactions for CCD007
//
//////////////////////////////////////////////////

/**
 * Fetch transactions for a given contract principal.
 * @param contractPrincipal
 * @returns An array of transactions for the given contract principal.
 */
async function fetchTransactions(
  contractPrincipal: string
): Promise<Transaction[]> {
  const contractName = contractPrincipal.split(".")[1];
  const transactionFile = `./results/ccip016-${contractName}-transactions.json`;

  // Load transactions from file if available
  let existingTransactions: Transaction[] = [];
  const existingTransactionsFile = await getFile(transactionFile);
  if (existingTransactionsFile) {
    existingTransactions = JSON.parse(existingTransactionsFile);
    console.log(
      `Loaded ${existingTransactions.length} transactions from file for ${contractName}`
    );
  } else {
    console.log(
      `No existing transactions file found for ${contractName}, starting fresh...`
    );
  }

  // Check count against total in API
  const endpoint = `/extended/v2/addresses/${contractPrincipal}/transactions`;
  const limit = 50;
  const url = new URL(endpoint, hiroApiBase);
  url.searchParams.set("limit", limit.toString());
  const response =
    await fancyFetch<AddressTransactionsWithTransfersListResponse>(
      url.toString()
    );
  const totalTransactions = response.total;
  const newTransactions = response.results.map((txRecord) => txRecord.tx);

  // Get unique transactions
  const uniqueTransactions = [
    ...existingTransactions,
    ...newTransactions.filter(
      (apiTx) =>
        !existingTransactions.some((fileTx) => fileTx.tx_id === apiTx.tx_id)
    ),
  ];

  console.log(
    `Total transactions in file for ${contractName}: ${existingTransactions.length}`
  );
  console.log(
    `Total transactions in API for ${contractName}: ${totalTransactions}`
  );
  console.log(
    `Total unique transactions for ${contractName}: ${uniqueTransactions.length}`
  );

  // Download any missing transactions
  if (uniqueTransactions.length < totalTransactions) {
    console.log(`Downloading missing transactions for ${contractName}...`);
    let offset = 0;
    const iterations = Math.ceil(totalTransactions / limit);
    for (let i = 1; i < iterations; i++) {
      printDivider();
      console.log(`iteration ${i} of ${iterations} for ${contractName}...`);
      offset += limit;
      url.searchParams.set("offset", offset.toString());
      const response =
        await fancyFetch<AddressTransactionsWithTransfersListResponse>(
          url.toString()
        );
      const newTransactions = response.results.map((txRecord) => txRecord.tx);
      console.log(
        `${newTransactions.length} new transactions for ${contractName}`
      );
      uniqueTransactions.push(
        ...newTransactions.filter(
          (apiTx) =>
            !uniqueTransactions.some((fileTx) => fileTx.tx_id === apiTx.tx_id)
        )
      );
      console.log(
        `${uniqueTransactions.length} total unique transactions for ${contractName}`
      );
      console.log(
        `progress for ${contractName}: ${
          uniqueTransactions.length
        } / ${totalTransactions} (${(
          (uniqueTransactions.length / totalTransactions) *
          100
        ).toFixed(2)}%)`
      );
      if (uniqueTransactions.length === totalTransactions) {
        break;
      }
    }
  }

  // Save transactions to file
  await writeFile(
    transactionFile,
    JSON.stringify(uniqueTransactions, null, 2),
    "utf-8"
  );

  return uniqueTransactions;
}

//////////////////////////////////////////////////
//
// Cycle data / block heights
// Functions to prepare and download block heights for CCIP016
//
//////////////////////////////////////////////////

/**
 * Get the Stacks block height for a given Bitcoin block height.
 * @param btcHeight Bitcoin block height
 * @param maxFetchRetries Maximum number of retries to attempt
 * @returns Stacks block height if found, otherwise null.
 */
async function getStxBlockHeight(
  btcHeight: number,
  maxFetchRetries: number = 5
): Promise<number | null> {
  async function tryGetStxBlockHeight(
    currentBtcHeight: number,
    retriesLeft: number
  ): Promise<number | null> {
    const btcToStxUrl = `${hiroApiBase}${btcToStxEndpoint}/${currentBtcHeight}/blocks`;
    const btcToStxData = await fancyFetch<BlockListResponse>(btcToStxUrl).catch(
      () => undefined
    );
    if (btcToStxData && btcToStxData.results.length > 0) {
      return btcToStxData.results[0].height;
    }
    if (retriesLeft > 0) {
      console.log(
        "No STX block found, retrying for BTC block:",
        currentBtcHeight + 1
      );
      return tryGetStxBlockHeight(currentBtcHeight + 1, retriesLeft - 1);
    }
    return null;
  }
  return tryGetStxBlockHeight(btcHeight, maxFetchRetries);
}

async function prepareCCIP016BlockHeights(
  cycleData: CycleData
): Promise<CycleData> {
  // check if all cycles have data
  const missingCycles: number[] = [];
  // loop through each cycle to check for missing data
  for (let cycle = startCycle; cycle <= endCycle; cycle++) {
    if (
      !cycleData[cycle] ||
      !cycleData[cycle]?.btcStartHeight ||
      !cycleData[cycle]?.btcEndHeight ||
      !cycleData[cycle]?.stxStartHeight ||
      !cycleData[cycle]?.stxEndHeight
    ) {
      missingCycles.push(cycle);
    }
  }
  // download any missing cycle data
  if (missingCycles.length > 0) {
    for (const cycle of missingCycles) {
      printDivider();
      console.log(`Fetching data for cycle ${cycle}`);
      // create the cycle object if it doesn't exist
      if (!cycleData[cycle]) {
        cycleData[cycle] = {
          btcStartHeight: null,
          btcEndHeight: null,
          stxStartHeight: null,
          stxEndHeight: null,
        };
      }
      // set the btc start height if it's missing
      if (!cycleData[cycle]?.btcStartHeight) {
        // get the first bitcoin block in the cycle
        const firstBlockUrl = `${ccApiBase}${firstBlockEndpoint}?cycle=${cycle}&format=raw`;
        const firstBlockResponse = await fancyFetch<string>(
          firstBlockUrl,
          false
        ).catch(() => undefined);
        let firstBlock: number | null;
        if (firstBlockResponse) {
          firstBlock = Number(firstBlockResponse);
        } else {
          firstBlock = null;
        }
        // store the block height in the object
        cycleData[cycle].btcStartHeight = firstBlock;
      }
      console.log("BTC start block:", cycleData[cycle].btcStartHeight);
      // set the btc end height if it's missing
      if (!cycleData[cycle]?.btcEndHeight) {
        // get the first bitcoin block in the cycle
        const endBlockUrl = `${ccApiBase}${firstBlockEndpoint}?cycle=${
          cycle + 1
        }&format=raw`;
        const endBlockResponse = await fancyFetch<string>(
          endBlockUrl,
          false
        ).catch(() => undefined);
        let endBlock: number | null;
        if (endBlockResponse) {
          endBlock = Number(endBlockResponse);
        } else {
          endBlock = null;
        }
        // store the block height in the object
        cycleData[cycle].btcEndHeight = endBlock;
      }
      console.log("BTC end block:", cycleData[cycle].btcEndHeight);
      // set the stacks start height if it's missing
      if (!cycleData[cycle]?.stxStartHeight) {
        const btcHeight = cycleData[cycle].btcStartHeight;
        if (btcHeight) {
          // get the corresponding stacks block height for the bitcoin block
          const stxHeight = await getStxBlockHeight(btcHeight);
          cycleData[cycle].stxStartHeight = stxHeight;
        }
      }
      console.log("STX start block:", cycleData[cycle].stxStartHeight);
      // set the stacks end height if it's missing
      if (!cycleData[cycle]?.stxEndHeight) {
        const btcHeight = cycleData[cycle].btcEndHeight;
        if (btcHeight) {
          // get the corresponding stacks block height for the bitcoin block
          const stxHeight = await getStxBlockHeight(btcHeight);
          cycleData[cycle].stxEndHeight = stxHeight;
        }
      }
      console.log("STX end block:", cycleData[cycle].stxEndHeight);
    }
  }
  // save cycle data to file
  await writeFile(cycleFilePath, JSON.stringify(cycleData, null, 2), "utf-8");
  // return cycle data
  return cycleData;
}

//////////////////////////////////////////////////
//
// Payout data based on cycle data
// Calculate the payouts for each cycle based on the CCD011 transactions
//
//////////////////////////////////////////////////

/**
 * Prepare the payout data for CCIP016 based on the CCD011 transactions.
 * @param payoutTransactions An array of CCD011 transactions.
 * @param cycleData The cycle data object with block heights per cycle.
 * @returns The payout data object with payout amounts and heights per cycle.
 */
async function prepareCCIP016PayoutData(
  payoutTransactions: ContractCallTransaction[],
  cycleData: CycleData
) {
  const payoutData: PayoutData = {};
  // loop through each payout transaction
  // and add to appropriate cycle as tx
  for (const cycle in cycleData) {
    const cycleNumber = Number(cycle);
    const cycleStxStartHeight = cycleData[cycleNumber].stxStartHeight;
    if (!cycleStxStartHeight) {
      continue;
    }
    const cycleEndStxHeight = cycleData[cycleNumber].stxEndHeight;
    if (!cycleEndStxHeight) {
      continue;
    }
    // find the payouts for the cycle
    const miaPayout = payoutTransactions.find(
      (tx) =>
        tx.tx_status === "success" &&
        tx.contract_call.function_name === "send-stacking-reward-mia" &&
        tx.contract_call.function_args &&
        Number(tx.contract_call.function_args[0].repr.replace("u", "")) ===
          cycleNumber
    );
    const nycPayout = payoutTransactions.find(
      (tx) =>
        tx.tx_status === "success" &&
        tx.contract_call.function_name === "send-stacking-reward-nyc" &&
        tx.contract_call.function_args &&
        Number(tx.contract_call.function_args[0].repr.replace("u", "")) ===
          cycleNumber
    );
    // extract the payout amounts per city
    const miaPayoutAmount = miaPayout
      ? miaPayout.contract_call.function_args
        ? miaPayout.contract_call.function_args[1].repr.replace("u", "")
        : null
      : null;
    const nycPayoutAmount = nycPayout
      ? nycPayout.contract_call.function_args
        ? nycPayout.contract_call.function_args[1].repr.replace("u", "")
        : null
      : null;
    // set the object values for the cycle
    payoutData[cycleNumber] = {
      tx: [miaPayout!, nycPayout!].filter(Boolean),
      miaPayoutAmount: Number(miaPayoutAmount) || null,
      miaPayoutCycle: cycleNumber,
      miaPayoutHeight: miaPayout?.block_height || null,
      miaPayoutHeightDiff: miaPayout
        ? miaPayout.block_height - cycleEndStxHeight
        : null,
      nycPayoutAmount: Number(nycPayoutAmount) || null,
      nycPayoutCycle: cycleNumber,
      nycPayoutHeight: nycPayout?.block_height || null,
      nycPayoutHeightDiff: nycPayout
        ? nycPayout.block_height - cycleEndStxHeight
        : null,
    };
  }
  // save payout data to a file
  await writeFile(
    "./results/ccip016-payout-data.json",
    JSON.stringify(payoutData, null, 2),
    "utf-8"
  );
  // return the data
  return payoutData;
}

//////////////////////////////////////////////////
//
// Missed payouts analysis
// Analyze the stacking transactions for missed payouts
//
//////////////////////////////////////////////////

/**
 * Analyze the missed payouts for each cycle.
 * @param cycleData The cycle data object with block heights per cycle.
 * @param payoutData The payout data object with payout amounts and heights per cycle.
 * @returns The missed payouts object with missed transactions per cycle.
 */
async function analyzeMissedPayouts(
  cycleData: CycleData,
  payoutData: PayoutData
) {
  // load CCD007 transactions for the cycle
  const contractName = "ccd007-citycoin-stacking";
  const transactionFilePath = `results/ccip016-${contractName}-transactions.json`;
  let existingTransactions: Transaction[] = [];
  const existingTransactionsFile = await getFile(transactionFilePath);
  if (existingTransactionsFile) {
    existingTransactions = JSON.parse(existingTransactionsFile);
    console.log(
      `Loaded ${existingTransactions.length} transactions from file for ${contractName}`
    );
  } else {
    console.log(
      `No existing transactions file found for ${contractName}, starting fresh...`
    );
  }
  // create objects to store missed payouts
  const missedPayouts: MissedPayouts = {};
  // loop through each cycle
  for (const cycle in cycleData) {
    // get the relevant data for the cycle
    const cycleNumber = Number(cycle);
    const cycleEndStxHeight = cycleData[cycleNumber].stxEndHeight;
    const miaPayoutHeight = payoutData[cycleNumber].miaPayoutHeight;
    const nycPayoutHeight = payoutData[cycleNumber].nycPayoutHeight;
    // check that all expected values exist
    if (!cycleEndStxHeight || !miaPayoutHeight || !nycPayoutHeight) {
      console.log(`Missing data for cycle ${cycleNumber}, skipping...`);
      continue;
    }
    // find the stacking transactions for the cycle
    // that call "claim-stacking-reward" and occurred between the stxEndHeight and the payout height
    const stackingTransactions = existingTransactions.filter(
      (tx) =>
        tx.tx_status === "success" &&
        tx.tx_type === "contract_call" &&
        tx.contract_call.function_name === "claim-stacking-reward" &&
        tx.block_height &&
        (cycleNumber === 83 || tx.block_height > cycleEndStxHeight) &&
        ((tx.contract_call.function_args![0].repr === '"mia"' &&
          tx.block_height < miaPayoutHeight) ||
          (tx.contract_call.function_args![0].repr === '"nyc"' &&
            tx.block_height < nycPayoutHeight)) &&
        tx.contract_call.function_args &&
        tx.contract_call.function_args[1].repr === `u${cycleNumber}`
    ) as ContractCallTransaction[];
    console.log(
      `${stackingTransactions.length} stacking transactions found in range for cycle ${cycleNumber}`
    );
    // find the missed payouts from those stacking transactions and separate by city
    const missedMiaPayouts = stackingTransactions.filter(
      (tx) =>
        tx.tx_type === "contract_call" &&
        tx.contract_call.function_name === "claim-stacking-reward" &&
        tx.contract_call.function_args &&
        tx.contract_call.function_args[0].repr === '"mia"'
    ) as ContractCallTransaction[];
    const missedNycPayouts = stackingTransactions.filter(
      (tx) =>
        tx.tx_type === "contract_call" &&
        tx.contract_call.function_name === "claim-stacking-reward" &&
        tx.contract_call.function_args &&
        tx.contract_call.function_args[0].repr === '"nyc"'
    ) as ContractCallTransaction[];

    // find user stacked cc
    const miaCityId = 1;
    const nycCityId = 2;
    const missedMiaPayoutData: {
      userStackingStats: number;
      tx: ContractCallTransaction;
    }[] = [];
    for (const tx of missedMiaPayouts) {
      const userStackingStats = await getUserStackingStats(miaCityId, tx);
      missedMiaPayoutData.push({
        userStackingStats,
        tx,
      });
    }
    const missedNycPayoutData: {
      userStackingStats: number;
      tx: ContractCallTransaction;
    }[] = [];
    for (const tx of missedNycPayouts) {
      const userStackingStats = await getUserStackingStats(nycCityId, tx);
      missedNycPayoutData.push({
        userStackingStats,
        tx,
      });
    }
    missedPayouts[cycleNumber] = {
      mia: missedMiaPayoutData,
      nyc: missedNycPayoutData,
    };
  }

  // save missed payouts to a file
  await writeFile(
    "./results/ccip016-missed-payouts.json",
    JSON.stringify(missedPayouts, null, 2),
    "utf-8"
  );

  return missedPayouts;
}

/**
 * Get user stacking stats from a transaction.
 * @param cityId The city ID for the transaction.
 * @param tx The transaction object.
 * @returns The user stacking stats object.
 */
async function getUserStackingStats(
  cityId: number,
  tx: ContractCallTransaction
): Promise<number> {
  const [contractAddress, contractName] =
    tx.contract_call.contract_id.split(".");
  const cycleId = tx.contract_call.function_args![1].repr.replace("u", "");
  const userId = (await callReadOnlyFunction({
    contractAddress,
    contractName: "ccd003-user-registry",
    functionName: "get-user-id",
    functionArgs: [principalCV(tx.sender_address)],
    network: network,
  })) as SomeCV<UIntCV>;
  const blockInfo = await getBlockInfo(tx.block_height - 1);
  const tip = blockInfo.index_block_hash.substring(2);
  const functionArgs = [
    uintCV(cityId),
    uintCV(cycleId),
    uintCV(userId.value.value),
  ];
  const userStackingStats = (await callReadOnlyFunction({
    contractAddress,
    contractName,
    functionName: "get-stacker",
    functionArgs,
    network: network,
    tip,
  })) as TupleCV<{ stacked: UIntCV; claimable: UIntCV }>;
  return Number(userStackingStats.data.stacked.value);
}

async function getBlockInfo(blockHeight: number) {
  const endpoint = `/extended/v2/blocks/${blockHeight}`;
  const url = new URL(endpoint, hiroApiBase);
  const response = await fancyFetch<{ index_block_hash: string }>(
    url.toString()
  );
  return response;
}
//////////////////////////////////////////////////
//
// Main function
// Runs the logic for the script using functions above.
//
//////////////////////////////////////////////////

async function main() {
  const contractDeployer = "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH";
  let contractName = "";

  // make sure ./results folder exists
  try {
    await mkdir("./results");
    console.log("Created results folder.");
  } catch (error) {
    if (
      error instanceof Error &&
      isNodeError(error) &&
      error.code === "EEXIST"
    ) {
      console.log("Verified results folder exists.");
      //return;
    } else {
      console.log("Error creating results folder.");
      throw error;
    }
  }

  // get all of the transactions for CCD007
  contractName = "ccd007-citycoin-stacking";
  printDivider();
  console.log("Preparing CCD007 transactions...");
  printDivider();
  const ccd007Transactions = await fetchTransactions(
    `${contractDeployer}.${contractName}`
  );

  // get all of the transactions for CCD011
  contractName = "ccd011-stacking-payouts";
  printDivider();
  console.log("Preparing CCD011 transactions...");
  printDivider();
  const ccd011Transactions = await fetchTransactions(
    `${contractDeployer}.${contractName}`
  );

  // populate the BTC and STX block heights for each cycle
  printDivider();
  console.log("Preparing CCIP016 block heights...");
  printDivider();
  let cycleData: CycleData = {};
  const cycleDataFile = await getFile(cycleFilePath);
  if (cycleDataFile) {
    console.log("Loading cycle data from file...");
    cycleData = JSON.parse(cycleDataFile);
  } else {
    console.log("No cycle data file found, starting fresh...");
  }
  cycleData = await prepareCCIP016BlockHeights(cycleData);

  // if there are any null values in cycleData
  // repeat until the null values are filled in
  while (true) {
    let missingData = false;
    for (const cycle in cycleData) {
      if (
        !cycleData[cycle]?.btcStartHeight ||
        !cycleData[cycle]?.btcEndHeight ||
        !cycleData[cycle]?.stxStartHeight ||
        !cycleData[cycle]?.stxEndHeight
      ) {
        printDivider();
        console.log("Missing data found in cycle", cycle, "retrying...");
        missingData = true;
        break;
      }
    }
    if (!missingData) {
      break;
    }
    cycleData = await prepareCCIP016BlockHeights(cycleData);
  }

  // populate the payout data
  printDivider();
  console.log("Preparing CCIP016 payout data...");
  printDivider();

  // filter CCD011 transactions for stacking payouts
  const payoutTransactions: ContractCallTransaction[] = [];
  const filteredTransactions = ccd011Transactions.filter(
    (tx) =>
      tx.tx_type === "contract_call" &&
      (tx.contract_call.function_name === "send-stacking-reward-mia" ||
        tx.contract_call.function_name === "send-stacking-reward-nyc")
  );
  for (const tx of filteredTransactions) {
    payoutTransactions.push(tx as ContractCallTransaction);
  }
  console.log(payoutTransactions.length, "payout transactions found.");

  // prepare the payout data
  const payoutData: PayoutData = await prepareCCIP016PayoutData(
    payoutTransactions,
    cycleData
  );

  /// idenfity missing payouts from stacking transactions using cycle data
  printDivider();
  console.log("Analyzing missed payouts...");
  printDivider();
  const missedPayoutTransactions = await analyzeMissedPayouts(
    cycleData,
    payoutData
  );

  // run analysis
  printDivider();
  console.log("Running analysis...");
  printDivider();
  console.log("Total CCD007 transactions:", ccd007Transactions.length);
  console.log("Total CCD011 transactions:", ccd011Transactions.length);
  console.log("Total CCD011 payout transactions:", payoutTransactions.length);

  printDivider();
  console.log("Cycle data:");
  printDivider();
  // output JSON data
  console.log(cycleData);
  // output markdown table
  printDivider();
  let markdownCycleData = `### CCIP-016 Cycle Data`;
  markdownCycleData += `\n| Cycle | BTC Start Height | BTC End Height | STX Start Height | STX End Height |`;
  markdownCycleData += `\n| --- | --- | --- | --- | --- |`;
  for (const cycle in cycleData) {
    const cycleNumber = Number(cycle);
    const btcStartHeight =
      cycleData[cycleNumber].btcStartHeight?.toLocaleString() ?? null;
    const btcEndHeight =
      cycleData[cycleNumber].btcEndHeight?.toLocaleString() ?? null;
    const stxStartHeight =
      cycleData[cycleNumber].stxStartHeight?.toLocaleString() ?? null;
    const stxEndHeight =
      cycleData[cycleNumber].stxEndHeight?.toLocaleString() ?? null;
    markdownCycleData += `\n| ${cycleNumber} | ${btcStartHeight} | ${btcEndHeight} | ${stxStartHeight} | ${stxEndHeight} |`;
  }
  // save markdown to a file
  await writeFile(
    "./results/ccip016-cycle-data.md",
    markdownCycleData,
    "utf-8"
  );
  // output markdown table
  console.log(markdownCycleData);

  printDivider();
  console.log("Payout data:");
  printDivider();
  // output JSON data
  console.log(payoutData);
  // output markdown table
  printDivider();
  let markdownPayoutData = `### CCIP-016 Payout Data`;
  markdownPayoutData += `\n| Cycle | MIA Payout Height | MIA Height Diff | MIA Payout Amount | NYC Payout Height | NYC Height Diff | NYC Payout Amount |`;
  markdownPayoutData += `\n| --- | --- | --- | --- | --- | --- | --- |`;
  for (const cycle in cycleData) {
    const cycleNumber = Number(cycle);
    const miaPayoutHeight =
      payoutData[cycleNumber].miaPayoutHeight?.toLocaleString() ?? null;
    const miaHeightDiff =
      payoutData[cycleNumber].miaPayoutHeightDiff?.toLocaleString() ?? null;
    const miaPayoutAmount = payoutData[cycleNumber].miaPayoutAmount
      ? displayMicro(payoutData[cycleNumber].miaPayoutAmount!)
      : null;
    const nycPayoutHeight =
      payoutData[cycleNumber].nycPayoutHeight?.toLocaleString() ?? null;
    const nycHeightDiff =
      payoutData[cycleNumber].nycPayoutHeightDiff?.toLocaleString() ?? null;
    const nycPayoutAmount = payoutData[cycleNumber].nycPayoutAmount
      ? displayMicro(payoutData[cycleNumber].nycPayoutAmount!)
      : null;
    markdownPayoutData += `\n| ${cycleNumber} | ${miaPayoutHeight} | ${miaHeightDiff} | ${miaPayoutAmount} | ${nycPayoutHeight} | ${nycHeightDiff} | ${nycPayoutAmount} |`;
  }
  // save markdown to a file
  await writeFile(
    "./results/ccip016-payout-data.md",
    markdownPayoutData,
    "utf-8"
  );
  // output markdown table
  console.log(markdownPayoutData);
  printDivider();
  console.log("Missed payout transactions:");
  printDivider();
  console.log(missedPayoutTransactions);
  printDivider();
  console.log("Analysis complete.");
  printDivider();
}

main();
