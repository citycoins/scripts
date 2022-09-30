import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { exit } from "process";
import { getStacksBlockHeight } from "../lib/stacks";
import { fetchJson, printDivider, sleep } from "../lib/utils";

async function getTransactions(principal: string) {
  const startBlock = 76666;
  const currentBlockHeight = await getStacksBlockHeight();
  let lastSeenBlock = currentBlockHeight;
  let counter = 0;
  let txs = [];
  const url = new URL(
    `https://stacks-node-api.mainnet.stacks.co/extended/v1/address/${principal}/transactions`
  );
  url.searchParams.set("limit", "50");

  // get all TX from the contract from block 76,666 to 77,377
  do {
    url.searchParams.set("offset", counter.toString());
    //console.log(url.toString());
    const response = await fetchJson(url.toString());
    //console.log(response);
    for (const result of response.results) {
      txs.push(result);
      counter++;
      lastSeenBlock =
        result.block_height < lastSeenBlock
          ? result.block_height
          : lastSeenBlock;
    }
    console.log(
      `${principal.split(".")[1].slice(0, 3)} last seen block: ${lastSeenBlock}`
    );
  } while (lastSeenBlock > startBlock);

  return txs;
}

async function filterMiningClaims(txs: any[]) {
  const miningClaims = txs.filter((tx) => {
    if (
      tx.tx_type === "contract_call" &&
      tx.tx_status === "success" &&
      tx.contract_call.function_name === "claim-mining-reward"
    ) {
      return true;
    }
  });
  return miningClaims;
}

async function getMintAmount(txId: string) {
  const url = new URL(
    `https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${txId}`
  );
  const response = await fetchJson(url.toString());
  return response.events[0].asset.amount;
}

async function filterFirstGroup(txs: any[]) {
  // first group:
  // IF the claim was sent between 76,666 and 76,990
  // AND the claim was for block height 76,666 or later
  const firstGroup = txs.filter((tx) => {
    if (tx.block_height >= 76666 && tx.block_height <= 76990) {
      const claimHeight = tx.contract_call.function_args[0].repr.replace(
        /u/g,
        ""
      );
      if (claimHeight >= 76666) return true;
    }
  });
  for (const tx of firstGroup) {
    tx.mintAmount = await getMintAmount(tx.tx_id);
  }
  return firstGroup;
}

async function filterSecondGroup(txs: any[], city: string) {
  // second group:
  // IF the claim was sent between 76,666 and 77,377
  // AND The claim was between
  //   MIA: 59,497 to 76,990
  //   NYC: 72,449 to 76,990
  const firstBlock =
    city === "mia" ? 59497 : city === "nyc" ? 72449 : undefined;
  if (!firstBlock) throw new Error("Invalid city");
  const secondGroup = txs.filter((tx) => {
    if (tx.block_height >= 76666 && tx.block_height <= 77377) {
      const claimHeight = tx.contract_call.function_args[0].repr.replace(
        /u/g,
        ""
      );
      if (claimHeight >= firstBlock && claimHeight <= 76990) return true;
    }
  });
  for (const tx of secondGroup) {
    tx.mintAmount = await getMintAmount(tx.tx_id);
  }
  return secondGroup;
}

async function compileByAddress(txs: any[]) {
  let senderList: SenderStats = {};
  for (const tx of txs) {
    if (!senderList[tx.sender_address]) {
      senderList[tx.sender_address] = [];
    }
    senderList[tx.sender_address].push({
      functionName: tx.contract_call.function_name,
      blockHeight: tx.block_height,
      claimHeight: tx.contract_call.function_args[0].repr.replace(/u/g, ""),
      mintAmount: tx.mintAmount,
    });
  }
  return senderList;
}

async function printAddressInfo(address: string, txDetails: TxDetails[]) {
  printDivider();
  console.log(`ADDRESS: ${address}`);
  console.log(`TOTAL: ${txDetails.length}`);
  console.table(txDetails);
}

async function run() {
  // get MIA and NYC core txs
  const txsExist =
    existsSync("./data/miaTxs.json") && existsSync("./data/nycTxs.json");
  let miaTxs, nycTxs;

  if (txsExist) {
    console.log("loading txs from file");
    miaTxs = JSON.parse(await readFile("./data/miaTxs.json", "utf8"));
    nycTxs = JSON.parse(await readFile("./data/nycTxs.json", "utf8"));
  } else {
    console.log("fetching txs from API");
    miaTxs = await getTransactions(
      "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2"
    );
    nycTxs = await getTransactions(
      "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2"
    );
    await writeFile("./data/miaTxs.json", JSON.stringify(miaTxs));
    await writeFile("./data/nycTxs.json", JSON.stringify(nycTxs));
  }

  console.log(`MIA TXs: ${miaTxs.length}`);
  console.log(`NYC TXs: ${nycTxs.length}`);

  // filter for all claim-mining-reward tx
  const [miaMiningClaims, nycMiningClaims] = await Promise.all([
    filterMiningClaims(miaTxs),
    filterMiningClaims(nycTxs),
  ]);

  console.log(`Filtered MIA Length: ${miaMiningClaims.length}`);
  console.log(`Filtered NYC Length: ${nycMiningClaims.length}`);

  // first group: should have been 2% but may have been 50k
  const firstGroupExists =
    existsSync("./data/miaTxsFirstGroup.json") &&
    existsSync("./data/nycTxsFirstGroup.json");
  let miaFirstGroup, nycFirstGroup;

  if (firstGroupExists) {
    console.log("loading first group from file");
    miaFirstGroup = JSON.parse(
      await readFile("./data/miaTxsFirstGroup.json", "utf8")
    );
    nycFirstGroup = JSON.parse(
      await readFile("./data/nycTxsFirstGroup.json", "utf8")
    );
  } else {
    console.log("fetching first group data from API");
    [miaFirstGroup, nycFirstGroup] = await Promise.all([
      filterFirstGroup(miaMiningClaims),
      filterFirstGroup(nycMiningClaims),
    ]);
    await writeFile(
      "./data/miaTxsFirstGroup.json",
      JSON.stringify(miaFirstGroup)
    );
    await writeFile(
      "./data/nycTxsFirstGroup.json",
      JSON.stringify(nycFirstGroup)
    );
  }

  console.log(`MIA First Group: ${miaFirstGroup.length}`);
  console.log(`NYC First Group: ${nycFirstGroup.length}`);

  // second group: should have been 50k but may have been 2%
  const secondGroupExists =
    existsSync("./data/miaTxsSecondGroup.json") &&
    existsSync("./data/nycTxsSecondGroup.json");
  let miaSecondGroup, nycSecondGroup;

  if (secondGroupExists) {
    console.log("loading second group from file");
    miaSecondGroup = JSON.parse(
      await readFile("./data/miaTxsSecondGroup.json", "utf8")
    );
    nycSecondGroup = JSON.parse(
      await readFile("./data/nycTxsSecondGroup.json", "utf8")
    );
  } else {
    console.log("fetching second group data from API");
    [miaSecondGroup, nycSecondGroup] = await Promise.all([
      filterSecondGroup(miaMiningClaims, "mia"),
      filterSecondGroup(nycMiningClaims, "nyc"),
    ]);
    await writeFile(
      "./data/miaTxsSecondGroup.json",
      JSON.stringify(miaSecondGroup)
    );
    await writeFile(
      "./data/nycTxsSecondGroup.json",
      JSON.stringify(nycSecondGroup)
    );
  }

  console.log(`MIA Second Group: ${miaSecondGroup.length}`);
  console.log(`NYC Second Group: ${nycSecondGroup.length}`);

  const [
    miaFirstGroupByAddress,
    nycFirstGroupByAddress,
    miaSecondGroupByAddress,
    nycSecondGroupByAddress,
  ] = await Promise.all([
    compileByAddress(miaFirstGroup),
    compileByAddress(nycFirstGroup),
    compileByAddress(miaSecondGroup),
    compileByAddress(nycSecondGroup),
  ]);

  // for each address

  printDivider();
  console.log("MIA FIRST GROUP");
  printDivider();
  for (const address in miaFirstGroupByAddress) {
    printAddressInfo(address, miaFirstGroupByAddress[address]);
  }

  printDivider();
  console.log("NYC FIRST GROUP");
  printDivider();
  for (const address in nycFirstGroupByAddress) {
    printAddressInfo(address, nycFirstGroupByAddress[address]);
  }

  printDivider();
  console.log("MIA SECOND GROUP");
  printDivider();
  for (const address in miaSecondGroupByAddress) {
    printAddressInfo(address, miaSecondGroupByAddress[address]);
  }

  printDivider();
  console.log("NYC SECOND GROUP");
  printDivider();
  for (const address in nycSecondGroupByAddress) {
    printAddressInfo(address, nycSecondGroupByAddress[address]);
  }
}

run();

interface SenderStats {
  [key: string]: TxDetails[];
}

interface TxDetails {
  blockHeight: number;
  functionName: string;
  claimHeight: number;
  // txid: string;
  mintAmount: number;
}
