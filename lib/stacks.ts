import * as bitcoin from "bitcoinjs-lib";
import { StacksMainnet, StacksTestnet } from "micro-stacks/network";
import {
  broadcastTransaction,
  makeContractCall,
  TxBroadcastResult,
} from "micro-stacks/transactions";
import {
  debugLog,
  exitError,
  fetchJson,
  fromMicro,
  printDivider,
  printTimeStamp,
  sleep,
} from "./utils";
import { TransactionVersion } from "micro-stacks/common";
import {
  generateNewAccount,
  generateWallet,
  getStxAddress,
} from "@stacks/wallet-sdk";

// mainnet toggle, otherwise testnet
export const MAINNET = false;

// bitcoin constants
const BITCOIN_TESTNET = bitcoin.networks.testnet;
const BITCOIN_MAINNET = bitcoin.networks.bitcoin;
export const BITCOIN_NETWORK = MAINNET ? BITCOIN_MAINNET : BITCOIN_TESTNET;

// stacks constants
export const DEFAULT_FEE = 50000; // 0.05 STX per TX
const STACKS_MAINNET = new StacksMainnet({
  coreApiUrl: "https://stacks-node-api.mainnet.stacks.co",
});
const STACKS_TESTNET = new StacksTestnet({
  coreApiUrl: "https://stacks-node-api.testnet.stacks.co",
});
// TODO: remove in favor of NETWORK
export const STACKS_NETWORK: StacksMainnet | StacksTestnet = MAINNET
  ? STACKS_MAINNET
  : STACKS_TESTNET;
// TODO: remove in favor of TX_VERSION
export const STACKS_TX_VERSION = MAINNET
  ? TransactionVersion.Mainnet
  : TransactionVersion.Testnet;

export const NETWORK = (network: string) => {
  if (network === "mainnet") {
    return STACKS_MAINNET;
  } else if (network === "testnet") {
    return STACKS_TESTNET;
  } else {
    return STACKS_TESTNET;
  }
};

const TX_VERSION = (network: string) => {
  if (network === "mainnet") {
    return TransactionVersion.Mainnet;
  } else if (network === "testnet") {
    return TransactionVersion.Testnet;
  } else {
    return TransactionVersion.Testnet;
  }
};

// get current Stacks block height
export async function getStacksBlockHeight(): Promise<number> {
  const url = `${STACKS_NETWORK.getCoreApiUrl()}/v2/info`;
  const currentBlockResult = await fetchJson(url);
  const currentBlock = +currentBlockResult.stacks_tip_height;
  debugLog(`currentBlock: ${currentBlock}`);
  return currentBlock;
}

// get current nonce for account
// https://stacks-node-api.mainnet.stacks.co/extended/v1/address/{principal}/nonces
export async function getNonce(address: string): Promise<number> {
  const url = `${STACKS_NETWORK.getCoreApiUrl()}/extended/v1/address/${address}/nonces`;
  const nonceResult = await fetchJson(url);
  const nonce = +nonceResult.possible_next_nonce;
  return nonce;
}

// get the total number of transactions in the Stacks mempool
export async function getTotalMempoolTx(): Promise<number> {
  const url = `${STACKS_NETWORK.getCoreApiUrl()}/extended/v1/tx/mempool`;
  const mempoolResult = await fetchJson(url);
  const totalTx = +mempoolResult.total;
  return totalTx;
}

// get account balances for a given address
export async function getStacksBalances(address: string): Promise<any> {
  const url = `${STACKS_NETWORK.getCoreApiUrl()}/extended/v1/address/${address}/balances`;
  const balanceResult = await fetchJson(url);
  return balanceResult;
}

// get optimal fee for transactions
// based on average of current fees in mempool
export async function getOptimalFee(multiplier: number, checkAllTx = false) {
  let counter = 0;
  let total = 0;
  let limit = 200;
  let url = "";
  let txResults: any = [];

  // query the stacks-node for multiple transactions
  do {
    url = `${STACKS_NETWORK.getCoreApiUrl()}/extended/v1/tx/mempool?limit=${limit}&offset=${counter}&unanchored=true`;
    const result = await fetchJson(url);
    // get total number of tx
    total = checkAllTx ? result.total : result.results.length;
    // add all transactions to main array
    result.results.map((tx: any) => {
      txResults.push(tx);
      counter++;
    });
    // output counter
    checkAllTx && console.log(`Processed ${counter} of ${total}`);
  } while (counter < total);

  const fees = txResults.map((fee: any) => +fee.fee_rate);

  const max = fees.reduce((a: number, b: number) => {
    return a > b ? a : b;
  });
  console.log(`maxFee: ${fromMicro(max)} STX`);

  const sum = fees.reduce((a: number, b: number) => a + b, 0);
  const avg = sum / txResults.length;
  console.log(`avgFee: ${fromMicro(avg)} STX`);

  const mid = Math.floor(fees.length / 2);
  const sorted = fees.sort((a: number, b: number) => a - b);
  const median: number =
    fees.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  console.log(`median: ${fromMicro(median)} STX`);

  const optimalFee = (avg + median) / 2;
  console.log(`multiplier: ${multiplier}`);
  console.log(`optimalFee: ${fromMicro(optimalFee)} STX`);

  return optimalFee * multiplier;
}

// monitor a transaction in pending status
// until confirmed or rejected
export async function monitorTx(
  broadcastedResult: TxBroadcastResult,
  txId: string
) {
  let count = 0;
  const countLimit = 50;
  const url = `${STACKS_NETWORK.coreApiUrl}/extended/v1/tx/${txId}`;

  do {
    const txResult = await fetchJson(url);

    printDivider();
    console.log(
      `TX STATUS: ${
        txResult.hasOwnProperty("tx_status")
          ? txResult.tx_status.toUpperCase()
          : "PENDING"
      }`
    );
    printDivider();
    printTimeStamp();
    console.log(`https://explorer.stacks.co/txid/${txResult.tx_id}`);
    console.log(`attempt ${count + 1} of ${countLimit}`);

    if ("error" in broadcastedResult) {
      console.log(`error: ${broadcastedResult.reason}`);
      console.log(`details:\n${JSON.stringify(broadcastedResult.reason_data)}`);
      console.log(
        `full error: ${(JSON.stringify(broadcastedResult), null, 2)}`
      );
      return 0;
    } else {
      if (txResult.tx_status === "success") {
        return txResult.block_height;
      }
      if (txResult.tx_status === "abort_by_post_condition") {
        exitError(
          `tx failed, exiting...\ntxid: ${txResult.tx_id}\nhttps://explorer.stacks.co/txid/${txResult.tx_id}`
        );
      }
    }
    // pause for 30min before checking again
    await sleep(300000);
    count++;
  } while (count < countLimit);

  console.log(`reached retry limit, manually check tx`);
  exitError(
    "Unable to find target block height for next transaction, exiting..."
  );
}

export async function submitTx(txOptions: any, network: string) {
  try {
    // console.log(`txOptions:\n${JSON.stringify(txOptions, fixBigInt, 2)}`);
    const transaction = await makeContractCall(txOptions);
    // console.log(`transaction:\n${JSON.stringify(transaction, fixBigInt, 2)}`);
    const broadcastResult = await broadcastTransaction(
      transaction,
      NETWORK(network)
    );
    if ("error" in broadcastResult) {
      console.log(`error: ${broadcastResult.reason}`);
      console.log(`details:\n${JSON.stringify(broadcastResult.reason_data)}`);
      exitError("Error broadcasting transaction, exiting...");
    }
    console.log(
      `link: https://explorer.stacks.co/txid/${transaction.txid()}?chain=${network}`
    );
  } catch (err) {
    exitError(
      `${String(err)}\nGeneric error broadcasting transaction, exiting...`
    );
  }
}

// TODO: best approach for using wallet data temporarily
const password = "StacksOnStacksOnStacks";

export async function getChildAccounts(
  mnemonic: string,
  index: number,
  network: string
) {
  // create a Stacks wallet with the mnemonic
  let wallet = await generateWallet({
    secretKey: mnemonic,
    password: password,
  });
  // add a new account to reach the selected index
  for (let i = 0; i <= index; i++) {
    wallet = generateNewAccount(wallet);
  }
  // return all addresses and keys
  const addresses = wallet.accounts.map((account) => {
    return getStxAddress({
      account: account,
      transactionVersion: TX_VERSION(network),
    });
  });
  const keys = wallet.accounts.map((account) => account.stxPrivateKey);
  return { addresses, keys };
}

// TODO: use to replace deriveChildAccount() below in refactor
export async function getChildAccount(
  mnemonic: string,
  index: number,
  network: string
) {
  // create a Stacks wallet with the mnemonic
  let wallet = await generateWallet({
    secretKey: mnemonic,
    password: password,
  });
  // add a new account to reach the selected index
  for (let i = 0; i <= index; i++) {
    wallet = generateNewAccount(wallet);
  }
  // return address and key for selected index
  const address = getStxAddress({
    account: wallet.accounts[index],
    transactionVersion: TX_VERSION(network),
  });
  const key = wallet.accounts[index].stxPrivateKey;
  return { address, key };
}

export async function deriveChildAccount(mnemonic: string, index: number) {
  // create a Stacks wallet with the mnemonic
  let wallet = await generateWallet({
    secretKey: mnemonic,
    password: password,
  });
  // add a new account to reach the selected index
  for (let i = 0; i <= index; i++) {
    wallet = generateNewAccount(wallet);
  }
  // return address and key for selected index
  return {
    address: getStxAddress({
      account: wallet.accounts[index],
      transactionVersion: STACKS_TX_VERSION,
    }),
    key: wallet.accounts[index].stxPrivateKey,
  };
}
