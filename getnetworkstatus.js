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
  const questions = {
    type: "confirm",
    name: "checkAllTx",
    message: "Check all TX? (default: first 200)",
    initial: false,
  };
  const submit = (prompt, answer, answers) => {
    if (prompt.name === "citycoin") {
      switch (answer) {
        case "MIA":
          answers.contractAddress = "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27";
          answers.contractName = "miamicoin-core-v1";
          break;
        case "NYC":
          answers.contractAddress = "SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5";
          answers.contractName = "newyorkcitycoin-core-v1";
          break;
      }
    }
  };
  const userConfig = await prompts(questions, {
    onCancel: cancelPrompt,
    onSubmit: submit,
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
