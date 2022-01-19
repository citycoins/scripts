import console from "console";
import prompts from "prompts";
import {
  exitWithError,
  getBlockHeight,
  getOptimalFee,
  getTotalMempoolTx,
} from "./utils.js";

/** @module GetNetworkStatus */

/**
 * @async
 * @function getNetworkStatus
 * @description Gets the current block height, mempool size, and average fees
 */
async function getNetworkStatus() {
  const userConfig = await prompts({
    type: "confirm",
    name: "checkAllTx",
    message: "Check all TX? (default: first 200)",
    initial: false,
  });
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
  await getOptimalFee(1, userConfig.checkAllTx).catch((err) =>
    exitWithError(`getOptimalFee err: ${err}`)
  );
}

getNetworkStatus();
