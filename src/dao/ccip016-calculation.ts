import {
  BlockListResponse,
  ContractCallTransaction,
  Transaction,
  AddressTransactionsWithTransfersListResponse,
} from "@stacks/stacks-blockchain-api-types";
import { readFile, writeFile } from "fs/promises";

//////////////////////////////////////////////////
//
// Downloads all transactions and performs analysis for CCIP-016
// Designed to run and produce independently verifiable results
// https://github.com/citycoins/governance/pull/16
//
//////////////////////////////////////////////////

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
const cycleFile = "./results/cycle-data.json";

// object to store the cycle data
interface CycleData {
  [key: number]: {
    // key: cycle number
    btcHeight: number | null;
    stxHeight: number | null;
  };
}

// object to store the payout data
// derived from the CCD011 transactions
interface PayoutData {
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
 * Check if given error object is a NodeJS error.
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

/**
 * Fetch transactions for a given contract principal.
 * @param contractPrincipal
 * @returns An array of transactions for the given contract principal.
 */
async function fetchTransactions(
  contractPrincipal: string
): Promise<Transaction[]> {
  const contractName = contractPrincipal.split(".")[1];
  const transactionFile = `results/${contractName}-transactions.json`;

  // Load transactions from file if available
  let existingTransactions: Transaction[] = [];
  try {
    const fileData = await readFile(transactionFile, "utf-8");
    existingTransactions = JSON.parse(fileData);
    console.log(
      `Loaded ${existingTransactions.length} transactions from file for ${contractName}`
    );
  } catch (error) {
    if (
      error instanceof Error &&
      isNodeError(error) &&
      error.code === "ENOENT"
    ) {
      console.log(
        `No existing transactions file found for ${contractName}, starting fresh...`
      );
    } else {
      console.error(
        `Error loading transactions from file for ${contractName}:`,
        error
      );
    }
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
 * @param maxRetries Maximum number of retries to attempt
 * @returns Stacks block height if found, otherwise null.
 */
async function getStxBlockHeight(
  btcHeight: number,
  maxRetries: number = 5
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
      return tryGetStxBlockHeight(currentBtcHeight + 1, retriesLeft - 1);
    }
    return null;
  }
  return tryGetStxBlockHeight(btcHeight, maxRetries);
}

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
      !cycleData[cycle]?.stxHeight
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
        };
      }
      // set the btc block height if it's missing
      if (!cycleData[cycle]?.btcHeight) {
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
        cycleData[cycle].btcHeight = firstBlock;
      }
      console.log("BTC block:", cycleData[cycle].btcHeight);
      // set the stacks block height if it's missing
      if (cycleData[cycle]?.btcHeight && !cycleData[cycle]?.stxHeight) {
        const btcHeight = cycleData[cycle].btcHeight;
        if (btcHeight) {
          // get the corresponding stacks block height for the bitcoin block
          const stxHeight = await getStxBlockHeight(btcHeight);
          cycleData[cycle].stxHeight = stxHeight;
        }
      }
      console.log("STX block:", cycleData[cycle].stxHeight);
    }
  }
  // save cycle data to file
  await writeFile(cycleFile, JSON.stringify(cycleData, null, 2), "utf-8");
  // return cycle data
  return cycleData;
}

async function prepareCCIP016PayoutData(
  payoutTransactions: ContractCallTransaction[],
  cycleData: CycleData
) {
  const payoutData: PayoutData = {};
  // loop through each payout transaction
  // and add to appropriate cycle as tx
  for (const cycle in cycleData) {
    const cycleNumber = Number(cycle);
    const cycleStxHeight = cycleData[cycleNumber].stxHeight;
    if (!cycleStxHeight) {
      continue;
    }
    // find the payouts for the cycle
    const miaPayout = payoutTransactions.find(
      (tx) =>
        tx.contract_call.function_name === "send-stacking-reward-mia" &&
        tx.contract_call.function_args &&
        Number(tx.contract_call.function_args[0].repr.replace("u", "")) ===
          cycleNumber
    );
    const nycPayout = payoutTransactions.find(
      (tx) =>
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
        ? Math.abs(miaPayout.block_height - cycleStxHeight)
        : null,
      nycPayoutAmount: Number(nycPayoutAmount) || null,
      nycPayoutCycle: cycleNumber,
      nycPayoutHeight: nycPayout?.block_height || null,
      nycPayoutHeightDiff: nycPayout
        ? Math.abs(nycPayout.block_height - cycleStxHeight)
        : null,
    };
  }
  // return the data
  return payoutData;
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
  const cycleData = await prepareCCIP016BlockHeights();

  // if there are any null values in cycleData
  // repeat until the null values are filled in
  let missingData = true;
  while (missingData) {
    missingData = false;
    for (const cycle in cycleData) {
      if (
        !cycleData[cycle].btcHeight ||
        !cycleData[cycle].stxHeight ||
        cycleData[cycle].btcHeight === null ||
        cycleData[cycle].stxHeight === null
      ) {
        missingData = true;
      }
    }
    if (missingData) {
      printDivider();
      console.log("Missing data found, retrying...");
      printDivider();
      await prepareCCIP016BlockHeights();
    }
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

  // run analysis
  printDivider();
  console.log("Running analysis...");
  printDivider();
  console.log("Total CCD007 transactions:", ccd007Transactions.length);
  console.log("Total CCD011 transactions:", ccd011Transactions.length);
  printDivider();
  // create a markdown table of the cycle data and payout data, per cycle
  let markdownTable = `| Cycle | BTC Height | STX Height | MIA Payout Height | MIA Height Diff | MIA Payout Amount | NYC Payout Height | NYC Height Diff | NYC Payout Amount |`;
  markdownTable += `\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |`;
  for (const cycle in cycleData) {
    const cycleNumber = Number(cycle);
    const btcHeight = cycleData[cycleNumber].btcHeight;
    const stxHeight = cycleData[cycleNumber].stxHeight;
    const miaPayoutHeight = payoutData[cycleNumber].miaPayoutHeight;
    const miaHeightDiff = payoutData[cycleNumber].miaPayoutHeightDiff;
    const miaPayoutAmount = payoutData[cycleNumber].miaPayoutAmount;
    const nycPayoutHeight = payoutData[cycleNumber].nycPayoutHeight;
    const nycHeightDiff = payoutData[cycleNumber].nycPayoutHeightDiff;
    const nycPayoutAmount = payoutData[cycleNumber].nycPayoutAmount;
    markdownTable += `\n| ${cycleNumber} | ${btcHeight} | ${stxHeight} | ${miaPayoutHeight} | ${miaHeightDiff} | ${miaPayoutAmount} | ${nycPayoutHeight} | ${nycHeightDiff} | ${nycPayoutAmount} |`;
  }

  // print the markdown table
  console.log(markdownTable);

  // save the markdown table to a file
  await writeFile(
    "./results/ccip016-cycle-analysis.md",
    markdownTable,
    "utf-8"
  );

  //console.log("Cycle data:", cycleData);
  //console.log("Payout data:", payoutData);

  printDivider();
  console.log("Analysis complete.");
  printDivider();
}

main();
