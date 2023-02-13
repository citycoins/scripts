import prompts from "prompts";
import {
  getOptimalFee,
  getStacksBlockHeight,
  getTotalMempoolTx,
} from "../../lib/stacks";
import {
  cancelPrompt,
  disclaimerIntro,
  exitError,
  exitSuccess,
  printDivider,
} from "../../lib/utils";

async function getNetworkStatus() {
  const userConfig = await prompts(
    [
      {
        type: "select",
        name: "network",
        message: "Select a network:",
        choices: [
          { title: "Mainnet", value: "mainnet" },
          { title: "Testnet", value: "testnet" },
        ],
      },
      {
        type: "toggle",
        name: "checkAllTx",
        message: "Check all TX? (default: first 200)",
        initial: false,
        active: "Yes",
        inactive: "No",
      },
    ],
    {
      onCancel: (prompt: any) => cancelPrompt(prompt.name),
    }
  );
  try {
    printDivider();
    // get current block height
    const currentBlock = await getStacksBlockHeight(userConfig.network);
    console.log(`currentBlock: ${currentBlock}`);
    // get current tx count in mempool
    const mempoolTxCount = await getTotalMempoolTx(userConfig.network);
    console.log(`mempoolTxCount: ${mempoolTxCount}`);
    // get optimal fee based on mempool
    const feeMultiplier = 1;
    await getOptimalFee(
      userConfig.network,
      feeMultiplier,
      userConfig.checkAllTx
    );
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
