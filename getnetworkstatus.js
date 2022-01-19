import console from "console";
import {
  exitWithError,
  getBlockHeight,
  getOptimalFee,
  getTotalMempoolTx,
} from "./utils.js";

/** @module GetNetworkStatus */

async function getNetworkStatus() {
  // get current block height
  const currentBlock = await getBlockHeight().catch((err) =>
    exitWithError(`getBlockHeight err: ${err}`)
  );
  console.log(`currentBlock: ${currentBlock}`);
  // get current mempool size
  const mempoolTxCount = await getTotalMempoolTx().catch((err) =>
    exitWithError(`getTotalMempoolTx err: ${err}`)
  );
  console.log(`mempoolTxCount: ${mempoolTxCount}`);
  // get estimated fee based on mempool average fees
  await getOptimalFee(1).catch((err) =>
    exitWithError(`getOptimalFee err: ${err}`)
  );
}

getNetworkStatus();
