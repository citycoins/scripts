// Downloads all transactions
// and performs analysis for CCIP-016
// https://github.com/citycoins/governance/pull/16

import { TransactionResults } from "@stacks/stacks-blockchain-api-types";
import { writeFile } from "fs/promises";

async function downloadCCD007Transactions() {
  // set contract info
  const contractDeployer = "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH";
  const contractName = "ccd007-citycoin-stacking";
  const contractAddress = `${contractDeployer}.${contractName}`;
  // set API info
  const apiBase = "https://api.mainnet.hiro.so";
  const endpoint = `/extended/v2/addresses/${contractAddress}/transactions`;
  // setup url for fetch
  const url = new URL(endpoint, apiBase);
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
  const transactions = data.results;
  console.log(
    `Fetched transactions: ${transactions.length} / ${data.total} (${Math.round(
      (transactions.length / data.total) * 100
    )}%)`
  );
  // loop through all transactions
  while (transactions.length < data.total) {
    offset += limit;
    url.searchParams.set("offset", offset.toString());
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.log("Fetch failed for offset: ", offset);
      console.log("Retrying after 5 seconds");
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    // parse the response and store in array
    const data: TransactionResults = await response.json();
    transactions.push(...data.results);
    console.log(
      `Fetched transactions: ${transactions.length} / ${
        data.total
      } (${Math.round((transactions.length / data.total) * 100)}%)`
    );
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

async function main() {
  await downloadCCD007Transactions();
}

main();
