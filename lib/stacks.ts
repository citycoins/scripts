import { StacksMainnet } from "micro-stacks/network";
import {
  StacksTransaction,
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

// stacks constants
export const STACKS_NETWORK = new StacksMainnet({
  coreApiUrl: "https://stacks-node-api.stacks.co",
});

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
  console.log(`optimalFee: ${fromMicro(optimalFee)} STX`);
  console.log(`multiplier: ${multiplier}`);

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
