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

// object to store the missed payout transactions
interface MissedPayouts {
  [key: number]: {
    mia: ContractCallTransaction[];
    nyc: ContractCallTransaction[];
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
      console.log(
        "No STX block found, retrying for BTC block:",
        currentBtcHeight + 1
      );
      return tryGetStxBlockHeight(currentBtcHeight + 1, retriesLeft - 1);
    }
    return null;
  }
  return tryGetStxBlockHeight(btcHeight, maxRetries);
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
  await writeFile(cycleFile, JSON.stringify(cycleData, null, 2), "utf-8");
  // return cycle data
  return cycleData;
}

//////////////////////////////////////////////////
//
// Payout data based on cycle data
// Calculate the payouts for each cycle based on the CCD011 transactions
//
//////////////////////////////////////////////////

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
  // return the data
  return payoutData;
}

//////////////////////////////////////////////////
//
// Missed payouts analysis
// Analyze the stacking transactions for missed payouts
//
//////////////////////////////////////////////////

async function analyzeMissedPayouts(
  cycleData: CycleData,
  payoutData: PayoutData
) {
  // load CCD007 transactions for the cycle
  const contractName = "ccd007-citycoin-stacking";
  const transactionFile = `results/${contractName}-transactions.json`;
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
        tx.block_height > cycleEndStxHeight &&
        tx.block_height < miaPayoutHeight
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
    missedPayouts[cycleNumber] = {
      mia: missedMiaPayouts,
      nyc: missedNycPayouts,
    };
  }

  return missedPayouts;
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
  //console.log("Cycle data:", cycleData);
  printDivider();
  //console.log("Payout data:", payoutData);
  printDivider();
  console.log("Missed payout transactions:", missedPayoutTransactions);
  printDivider();
  // create a markdown table of the analysis data
  let markdownTable = `# CCIP-016 Cycle Analysis`;
  markdownTable += `\n| Cycle | BTC Start Height | BTC End Height | STX Start Height | STX End Height |  MIA Payout Height | MIA Height Diff | MIA Payout Amount | NYC Payout Height | NYC Height Diff | NYC Payout Amount |`;
  markdownTable += `\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`;
  for (const cycle in cycleData) {
    const cycleNumber = Number(cycle);
    const btcStartHeight = cycleData[cycleNumber].btcStartHeight;
    const btcEndHeight = cycleData[cycleNumber].btcEndHeight;
    const stxStartHeight = cycleData[cycleNumber].stxStartHeight;
    const stxEndHeight = cycleData[cycleNumber].stxEndHeight;
    const miaPayoutHeight = payoutData[cycleNumber].miaPayoutHeight;
    const miaHeightDiff = payoutData[cycleNumber].miaPayoutHeightDiff;
    const miaPayoutAmount = payoutData[cycleNumber].miaPayoutAmount;
    const nycPayoutHeight = payoutData[cycleNumber].nycPayoutHeight;
    const nycHeightDiff = payoutData[cycleNumber].nycPayoutHeightDiff;
    const nycPayoutAmount = payoutData[cycleNumber].nycPayoutAmount;
    markdownTable += `\n| ${cycleNumber} | ${btcStartHeight} | ${btcEndHeight} | ${stxStartHeight} | ${stxEndHeight} | ${miaPayoutHeight} | ${miaHeightDiff} | ${miaPayoutAmount} | ${nycPayoutHeight} | ${nycHeightDiff} | ${nycPayoutAmount} |`;
  }

  // print the markdown table
  //console.log(markdownTable);

  // save the markdown table to a file
  await writeFile(
    "./results/ccip016-cycle-analysis.md",
    markdownTable,
    "utf-8"
  );
  printDivider();
  console.log("Analysis complete.");
  printDivider();
}

main();
