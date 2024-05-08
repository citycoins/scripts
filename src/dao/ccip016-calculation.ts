// Downloads all transactions
// and performs analysis for CCIP-016
// https://github.com/citycoins/governance/pull/16

import {
  BlockListResponse,
  TransactionResults,
} from "@stacks/stacks-blockchain-api-types";
import { writeFile } from "fs/promises";

const hiroApiBase = "https://api.mainnet.hiro.so";
const ccApiBase = "https://protocol.citycoins.co/api";

interface CycleData {
  [key: number]: {
    btcHeight?: number;
    stxHeight?: number;
  };
}

/**
 * This function will download all of the transactions for the CCD007 contract and save them to a file.
 */
async function downloadCCD007Transactions() {
  // set contract info
  const contractDeployer = "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH";
  const contractName = "ccd007-citycoin-stacking";
  const contractAddress = `${contractDeployer}.${contractName}`;
  // set API info
  const endpoint = `/extended/v2/addresses/${contractAddress}/transactions`;
  // setup url for fetch
  const url = new URL(endpoint, hiroApiBase);
  const limit = 50;
  let offset = 0;
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());

  // make initial fetch to get the total
  const response = await fetch(url.toString());
  // pass through if any errors
  if (!response.ok) {
    throw new Error(
      `Failed to fetch transactions for ${contractAddress} from Stacks Node API: ${response.status}, ${response.statusText}`
    );
  }
  // parse the response
  const data: TransactionResults = await response.json();
  console.log("Total transactions: ", data.total);
  // setup the array to store all transactions
  const failedOffsets: number[] = [];
  const transactions = data.results;
  const totalTransactions = data.total;
  const iterations = Math.ceil(totalTransactions / limit);
  console.log(
    `Fetched transactions: ${
      transactions.length
    } / ${totalTransactions} (${Math.round(
      (transactions.length / totalTransactions) * 100
    )}%)`
  );
  // loop and fetch all transactions in API
  for (let i = 1; i < iterations; i++) {
    offset += limit;
    url.searchParams.set("offset", offset.toString());
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.log("Fetch failed for offset: ", offset);
      failedOffsets.push(offset);
      console.log("Retrying after 5 seconds");
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    // parse the response and store in array
    const data: TransactionResults = await response.json();
    transactions.push(...data.results);
    console.log(
      `Fetched transactions: ${
        transactions.length
      } / ${totalTransactions} (${Math.round(
        (transactions.length / totalTransactions) * 100
      )}%)`
    );
  }

  // retry failed offsets
  while (failedOffsets.length > 0) {
    const failedOffset = failedOffsets.shift();
    url.searchParams.set("offset", failedOffset!.toString());
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.log("Retry failed for offset: ", failedOffset);
      failedOffsets.push(failedOffset!);
      console.log("Retrying after 5 seconds");
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    const data: TransactionResults = await response.json();
    transactions.push(...data.results);
    console.log(
      `Fetched transactions: ${
        transactions.length
      } / ${totalTransactions} (${Math.round(
        (transactions.length / totalTransactions) * 100
      )}%)`
    );
  }

  // show that totals match
  console.log(
    `Verifying total transactions: ${transactions.length} / ${totalTransactions}`
  );
  // check if the transactions are the same
  if (transactions.length !== totalTransactions) {
    console.error("Transactions do not match");
    return;
  }
  // create a timestamp YYYY-MM-DD-HH-MM-SS
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  // store the transactions in a file
  await writeFile(
    `./${timestamp}-transactions.json`,
    JSON.stringify(transactions, null, 2),
    "utf-8"
  );
}

/*
BETTER PATTERN

fill the object with the keys
iterate over the keys and fill in bitcoin block height
iterate over the keys and fill in stacks block height
easier to retry and handle edge cases?
*/

/**
 * This function will get the block heights for the stacking cycles in the CCD007 contract.
 */
async function getCCD007BlockHeights() {
  // start and end taken from CCIP-020
  // https://github.com/citycoins/governance/blob/feat/add-ccip-022/ccips/ccip-020/ccip-020-graceful-protocol-shutdown.md
  const startCycle = 54;
  const endCycle = 83;

  // endpoint to get first bitcoin block in cycle
  // expects query param cycle
  const firstBlockEndpoint =
    "/ccd007-citycoin-stacking/get-first-block-in-reward-cycle";
  // endpoint to get stacks block for bitcoin block
  const btcToStxEndpoint = "/extended/v2/burn-blocks";

  const cycleData: CycleData = {};

  // loop through each cycle to build the information
  for (let cycle = startCycle; cycle <= endCycle; cycle++) {
    let btcHeight: number | undefined;
    let stxHeight: number | undefined;
    console.log(`Fetching data for cycle ${cycle}`);
    try {
      // check if we already have the data for the cycle
      if (
        cycleData[cycle] &&
        cycleData[cycle]?.btcHeight &&
        cycleData[cycle]?.stxHeight
      ) {
        console.log(`Already have data for cycle ${cycle}`);
        continue;
      }

      // check if we have the bitcoin block height
      if (cycleData[cycle].btcHeight) {
        console.log(`Setting Bitcoin block from cycle data`);
        btcHeight = cycleData[cycle].btcHeight;
      } else {
        console.log(`Fetching Bitcoin block for cycle ${cycle}`);
        // get the first bitcoin block in the cycle
        const firstBlockUrl = `${ccApiBase}${firstBlockEndpoint}?cycle=${cycle}&format=raw`;
        const firstBlockResponse = await fetch(firstBlockUrl);
        if (!firstBlockResponse.ok) {
          throw new Error(
            `Failed to fetch first block for cycle ${cycle}: ${firstBlockResponse.status}, ${firstBlockResponse.statusText}`
          );
        }
        const firstBlock = await firstBlockResponse.text();
        btcHeight = Number(firstBlock);
      }
      console.log(`btc block: ${btcHeight}`);

      // check if we have the stacks block height
      if (cycleData[cycle].stxHeight) {
        stxHeight = cycleData[cycle].stxHeight;
      } else {
      }
      if (!cycleData[cycle].stxHeight) {
        // get the corresponding stacks block height
        const btcToStxUrl = `${hiroApiBase}${btcToStxEndpoint}/${btcHeight}/blocks`;
        const btcToStxResponse = await fetch(btcToStxUrl);

        // if a 404
        if (btcToStxResponse.status === 404) {
          console.log(
            `No Stacks block found for Bitcoin block ${btcHeight}. Skipping cycle ${cycle}`
          );
          continue;
        }
        // else if not ok
        if (!btcToStxResponse.ok) {
          throw new Error(
            `Failed to fetch Stacks block height for Bitcoin block ${btcHeight}: ${btcToStxResponse.status}, ${btcToStxResponse.statusText}`
          );
        }

        const btcToStxData: BlockListResponse = await btcToStxResponse.json();
        stxHeight = btcToStxData.results[0].height;
      }
      console.log(`stx block: ${stxHeight}`);

      // store the cycle data
      cycleData[cycle] = {
        btcHeight,
        stxHeight,
      };
    } catch (error) {
      console.error(`Error fetching data for cycle ${cycle}:`, error);
    }
  }

  // create a timestamp YYYY-MM-DD-HH-MM-SS
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  // store the cycle data in a file
  await writeFile(
    `./${timestamp}-cycle-data.json`,
    JSON.stringify(cycleData, null, 2),
    "utf-8"
  );
}

async function main() {
  // await downloadCCD007Transactions();
  await getCCD007BlockHeights();
}

main();
