import console from "console";
import prompts from "prompts";
import {
  cancelPrompt,
  err,
  exitWithError,
  exitWithSuccess,
  printDivider,
  printTimeStamp,
  safeFetch,
  STACKS_NETWORK,
  timer,
  title,
  USTX,
  warn,
} from "./utils.js";

/** @module GetTxStatus */

/**
 * @async
 * @function promptUserConfig
 * @description Prompts the user for configuration options at the start of the script
 * @returns {Object[]} An object that contains properties for each question name and related answers as a values
 */
async function promptUserConfig() {
  const questions = [
    {
      type: "text",
      name: "txid",
      message: "TXID to check?",
      validate: (value) => (value === "" ? "TXID is required" : true),
    },
    {
      type: "number",
      name: "interval",
      message: "Interval (minutes) to check?",
      validate: (value) =>
        value > 0 ? true : "Interval must be 15min or greater",
    },
  ];
  const userConfig = await prompts(questions, { onCancel: cancelPrompt });
  return userConfig;
}

/**
 * @async
 * @function getTxStatus
 * @param {Object[]} userConfig An object that contains properties for each question name and related answers as a values
 * @description Gets the status for a provided TXID on a set interval
 */
async function getTxStatus(userConfig) {
  let count = 0;
  const countLimit = 100;
  const url = `${STACKS_NETWORK.coreApiUrl}/extended/v1/tx/${userConfig.txid}`;
  const interval = userConfig.interval * 60 * 1000;

  do {
    const txResult = await safeFetch(url);
    printDivider();
    console.log(
      title(
        `TX STATUS: ${
          txResult.hasOwnProperty("tx_status")
            ? txResult.tx_status.toUpperCase()
            : "PENDING"
        }`
      )
    );
    printDivider();
    printTimeStamp();

    // exit if success or fail
    if (txResult.tx_status === "success") {
      exitWithSuccess(
        `tx succeeded, exiting...\ntxid: ${txResult.tx_id}\nhttps://explorer.stacks.co/txid/${txResult.tx_id}`
      );
    }
    if (txResult.tx_status === "abort_by_post_condition") {
      exitWithError(
        `tx failed, exiting...\ntxid: ${txResult.tx_id}\nhttps://explorer.stacks.co/txid/${txResult.tx_id}`
      );
    }

    // log tx details
    console.log(
      `account: ${txResult.sender_address.slice(
        0,
        5
      )}...${txResult.sender_address.slice(txResult.sender_address.length - 5)}`
    );
    console.log(`nonce: ${txResult.nonce}`);
    console.log(`fee: ${(txResult.fee_rate / USTX).toFixed(6)} STX`);
    const submitDate = new Date(txResult.receipt_time_iso);
    const submitted = submitDate.toLocaleString().replace(/,/g, "");
    console.log(`submitted: ${submitted}`);
    // calculate time passed since submission in hours
    const currentDate = new Date();
    const timePassed = (
      (currentDate.getTime() - submitDate.getTime()) /
      1000 /
      60 /
      60
    ).toFixed(2);
    // add color if pending for a long time
    if (parseInt(timePassed) > 4) {
      console.log(err(`timePassed: ${timePassed} hours`));
    } else if (parseInt(timePassed) > 2) {
      console.log(warn(`timePassed: ${timePassed} hours`));
    } else {
      console.log(`timePassed: ${timePassed} hours`);
    }
    // print link to tx on explorer
    console.log(`https://explorer.stacks.co/txid/${txResult.tx_id}`);

    // pause before checking again
    await timer(interval);
    count++;
  } while (count < countLimit);
}

promptUserConfig().then((answers) => getTxStatus(answers));
