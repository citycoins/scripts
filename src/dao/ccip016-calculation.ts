import {
  BlockListResponse,
  TransactionResults,
  Transaction,
  AddressTransactionsWithTransfersListResponse,
  Block,
} from "@stacks/stacks-blockchain-api-types";
import { readFile, writeFile } from "fs/promises";

//////////////////////////////////////////////////
//
// Downloads all transactions and performs analysis for CCIP-016
// Designed to run and produce independently verifiable results
// https://github.com/citycoins/governance/pull/16
//
//////////////////////////////////////////////////

// set contract info
const contractDeployer = "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH";
const contractName = "ccd007-citycoin-stacking";
const contractAddress = `${contractDeployer}.${contractName}`;

// set API base urls
const hiroApiBase = "https://api.mainnet.hiro.so";
const ccApiBase = "https://protocol.citycoins.co/api";
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

//////////////////////////////////////////////////
//
// Helper functions
// Tools and logic reused elsewhere in the script.
//
//////////////////////////////////////////////////

// file paths
const transactionFile = "./results/transactions.json";
const cycleFile = "./results/cycle-data.json";

// object to store the cycle data
interface CycleData {
  [key: number]: {
    btcHeight: number | null;
    stxHeight: number | null;
    payoutHeight: number | null;
  };
}

// simple sleep function
async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// fetch function with retries
const maxRetries = 3;
async function fancyFetch<T>(
  url: string,
  json = true,
  retries = maxRetries,
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
 * @param error the error object.
 * @returns if given error object is a NodeJS error.
 */
const isNodeError = (error: Error): error is NodeJS.ErrnoException =>
  error instanceof Error;

// print a divider to the console
function printDivider() {
  console.log("-------------------------");
}

//////////////////////////////////////////////////
//
// Transactions
// Functions to prepare and download transactions for CCD007
//
//////////////////////////////////////////////////

async function prepareCCD007Transactions() {
  // load txs from file
  let existingTransactions: Transaction[] = [];
  try {
    const fileData = await readFile(transactionFile, "utf-8");
    existingTransactions = JSON.parse(fileData);
    console.log(`Loaded ${existingTransactions.length} transactions from file`);
  } catch (error) {
    if (
      error instanceof Error &&
      isNodeError(error) &&
      error.code === "ENOENT"
    ) {
      console.log("No existing transactions file found, starting fresh...");
    } else {
      console.error("Error loading transactions from file:", error);
    }
  }
  // check count against total in API
  const endpoint = `/extended/v2/addresses/${contractAddress}/transactions`;
  const limit = 50;
  const url = new URL(endpoint, hiroApiBase);
  url.searchParams.set("limit", limit.toString());
  const response =
    await fancyFetch<AddressTransactionsWithTransfersListResponse>(
      url.toString()
    );
  const totalTransactions = response.total;
  const newTransactions = response.results.map((txRecord) => txRecord.tx);
  // get unique transactions
  const uniqueTransactions = [
    ...existingTransactions,
    ...newTransactions.filter(
      (apiTx) =>
        !existingTransactions.some((fileTx) => fileTx.tx_id === apiTx.tx_id)
    ),
  ];
  console.log(`Total transactions in file: ${existingTransactions.length}`);
  console.log(`Total transactions in API: ${totalTransactions}`);
  console.log(`Total unique transactions: ${uniqueTransactions.length}`);
  // download any missing transactions
  if (uniqueTransactions.length < totalTransactions) {
    console.log("Downloading missing transactions...");
    let offset = 0;
    const iterations = Math.ceil(totalTransactions / limit);
    for (let i = 1; i < iterations; i++) {
      printDivider();
      console.log("iteration", i, "of", iterations, "...");
      offset += limit;
      url.searchParams.set("offset", offset.toString());
      const response =
        await fancyFetch<AddressTransactionsWithTransfersListResponse>(
          url.toString()
        );
      // filter out the transactions that already exist in uniqueTransactions
      const newTransactions = response.results.map((txRecord) => txRecord.tx);
      console.log(newTransactions.length, "new transactions");
      // add the new unique transactions
      uniqueTransactions.push(
        ...newTransactions.filter(
          (apiTx) =>
            !uniqueTransactions.some((fileTx) => fileTx.tx_id === apiTx.tx_id)
        )
      );
      console.log(uniqueTransactions.length, "total unique transactions");
      // log unique against total with percentage
      console.log(
        `progress: ${uniqueTransactions.length} / ${totalTransactions} (${(
          (uniqueTransactions.length / totalTransactions) *
          100
        ).toFixed(2)}%)`
      );
      // exit loop if we get to the expected total
      if (uniqueTransactions.length === totalTransactions) {
        break;
      }
    }
  }
  // save txs to file
  await writeFile(
    transactionFile,
    JSON.stringify(uniqueTransactions, null, 2),
    "utf-8"
  );
  // return transactions
  return uniqueTransactions;
}

//////////////////////////////////////////////////
//
// Cycle data / block heights
// Functions to prepare and download block heights for CCIP016
//
//////////////////////////////////////////////////

async function prepareCCIP016BlockHeights() {
  // load cycle data from file
  let cycleData: CycleData = {};
  try {
    const fileData = await readFile(cycleFile, "utf-8");
    cycleData = JSON.parse(fileData);
    console.log(`Loaded cycle data from file`);
  } catch (error) {
    if (
      error instanceof Error &&
      isNodeError(error) &&
      error.code === "ENOENT"
    ) {
      console.log("No existing block heights file found, starting fresh...");
    } else {
      console.error("Error loading block heights from file:", error);
    }
  }
  // check if all cycles have data
  const missingCycles: number[] = [];
  // loop through each cycle to check for missing data
  for (let cycle = startCycle; cycle <= endCycle; cycle++) {
    if (
      !cycleData[cycle] ||
      !cycleData[cycle]?.btcHeight ||
      !cycleData[cycle]?.stxHeight ||
      !cycleData[cycle]?.payoutHeight
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
          btcHeight: null,
          stxHeight: null,
          payoutHeight: null,
        };
      }
      // set the btc block height if it's missing
      if (!cycleData[cycle]?.btcHeight) {
        // get the first bitcoin block in the cycle
        const firstBlockUrl = `${ccApiBase}${firstBlockEndpoint}?cycle=${cycle}&format=raw`;
        const firstBlockResponse = await fancyFetch<string>(
          firstBlockUrl,
          false
        );
        const firstBlock = Number(firstBlockResponse);
        // store the block height in the object
        console.log("BTC block:", firstBlock);
        cycleData[cycle].btcHeight = firstBlock;
      }
      // set the stacks block height if it's missing
      if (cycleData[cycle]?.btcHeight && !cycleData[cycle]?.stxHeight) {
        const btcHeight = cycleData[cycle].btcHeight;
        if (btcHeight) {
          // get the corresponding stacks block height
          const btcToStxUrl = `${hiroApiBase}${btcToStxEndpoint}/${btcHeight}/blocks`;
          const btcToStxData = await fancyFetch<BlockListResponse>(
            btcToStxUrl
          ).catch(() => {
            // return empty results in object
            return undefined;
          });
          let results: Block[] = [];
          console.log("STX block data:", btcToStxData);
          if (btcToStxData && btcToStxData.results.length > 0) {
            // use the results if they exist
            results = btcToStxData.results;
          } else {
            // retry with one block previous
            const btcToStxUrlPrev = `${hiroApiBase}${btcToStxEndpoint}/${
              btcHeight - 1
            }/blocks`;
            const btcToStxDataPrev = await fancyFetch<BlockListResponse>(
              btcToStxUrlPrev
            ).catch(() => {
              // return empty results in object
              return undefined;
            });
            console.log("STX block data (prev):", btcToStxDataPrev);
            if (btcToStxDataPrev && btcToStxDataPrev.results.length > 0) {
              // use the results if they exist
              results = btcToStxDataPrev.results;
            }
          }
          const stxBlock = results.length > 0 ? results[0].height : null;
          console.log("STX block:", stxBlock);
          cycleData[cycle].stxHeight = stxBlock;
        }
      }
      // set the payout block height if it's missing
      if (!cycleData[cycle]?.payoutHeight) {
        // need to decide what to do here
        console.log("Payout block:", null);
      }
    }
  }
  // save cycle data to file
  await writeFile(cycleFile, JSON.stringify(cycleData, null, 2), "utf-8");
  // return cycle data
  return cycleData;
}

//////////////////////////////////////////////////
//
// Main function
// Runs the logic for the script using functions above.
//
//////////////////////////////////////////////////

async function main() {
  // get all of the transaction for CCD007
  printDivider();
  console.log("Preparing CCD007 transactions...");
  printDivider();
  const transactionData = await prepareCCD007Transactions();

  // get all of the block heights for CCIP-016
  printDivider();
  console.log("Preparing CCIP016 block heights...");
  printDivider();
  const cycleData = await prepareCCIP016BlockHeights();

  // run analysis
  printDivider();
  console.log("Running analysis...");
  printDivider();
  console.log("Total transactions:", transactionData.length);
  console.log("Cycle data:", cycleData);
}

main();
