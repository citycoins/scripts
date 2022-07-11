import prompts from "prompts";
import {
  getOptimalFee,
  getStacksBlockHeight,
  getTotalMempoolTx,
} from "../lib/stacks";
import {
  disclaimerIntro,
  exitError,
  exitSuccess,
  printDivider,
} from "../lib/utils";

async function getNetworkStatus() {
  const userConfig = await prompts({
    type: "confirm",
    name: "checkAllTx",
    message: "Check all TX? (default: first 200)",
    initial: false,
  });
  try {
    printDivider();
    // get current block height
    const currentBlock = await getStacksBlockHeight();
    console.log(`currentBlock: ${currentBlock}`);
    // get current tx count in mempool
    const mempoolTxCount = await getTotalMempoolTx();
    console.log(`mempoolTxCount: ${mempoolTxCount}`);
    // get optimal fee based on mempool
    const feeMultiplier = 1;
    await getOptimalFee(feeMultiplier, userConfig.checkAllTx);
  } catch (err) {
    if (err instanceof Error) exitError(err.message);
    exitError(String(err));
  }
}

async function main() {
  disclaimerIntro(
    "Network Status",
    "Queries and displays the current network information from a Stacks node.",
    false
  );
  await getNetworkStatus();
  printDivider();
  exitSuccess("all actions complete, script exiting...");
}

main();
