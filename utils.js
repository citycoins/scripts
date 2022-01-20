import chalk from "chalk";
import prompts from "prompts";
import { StacksMainnet } from "@stacks/network";
import {
  callReadOnlyFunction,
  cvToJSON,
  cvToValue,
  standardPrincipalCV,
  uintCV,
} from "@stacks/transactions";

export const title = chalk.bold.blue;
export const success = chalk.bold.green;
export const warn = chalk.bold.yellow;
export const err = chalk.bold.red;

/** @module Utilities */

/**
 * @constant
 * @type {integer}
 * @description used to convert uSTX to STX and reverse
 * @default
 */
export const USTX = 1000000;

/**
 * @constant
 * @type {StacksNetwork}
 * @description default Stacks network to connect to
 * @default
 */
export const STACKS_NETWORK = new StacksMainnet();
//STACKS_NETWORK.coreApiUrl = "http://157.245.221.74:3999";
STACKS_NETWORK.coreApiUrl = "https://stacks-node-api.stacks.co";
//STACKS_NETWORK.coreApiUrl = "https://mainnet.syvita.org";

/**
 * @async
 * @function safeFetch
 * @param {string} url URL to fetch JSON content from
 * @description Returns the JSON content from the specified URL
 * @returns {Object[]} JSON object
 */
export async function safeFetch(url) {
  // wrapper to handle common errors for fetching from the API
  const response = await fetch(url);
  if (response.status === 200) {
    // success
    const responseJson = await response.json();
    return responseJson;
  } else {
    // error
    exitWithError(`safeFetch err: ${response.status} ${response.statusText}`);
  }
}

/**
 * @async
 * @function timer
 * @param {integer} ms number of milliseconds
 * @description Sleeps for the given amount of milliseconds
 */
export const timer = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * @function cancelPrompt
 * @param {Object[]} prompt An object that contains the current prompt displayed to the user
 * @description Catches a cancel event in prompts, sets the message, and exits the AutoMiner
 */
export const cancelPrompt = (prompt) => {
  exitWithError(`ERROR: cancelled by user at ${prompt.name}, exiting...`);
};

/**
 * @async
 * @function processTx
 * @param {TxBroadcastResult} broadcastedResult result from broadcastTransaction() in @stacks/transactions
 * @param {string} tx the txid of the transaction
 * @description Monitors a transaction and returns the block height it succeeds at
 * @returns {integer}
 */
export async function processTx(broadcastedResult, tx) {
  let count = 0;
  const countLimit = 50;
  const url = `${STACKS_NETWORK.coreApiUrl}/extended/v1/tx/${tx}`;

  do {
    const result = await fetch(url);
    const txResult = await result.json();

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
    console.log(`https://explorer.stacks.co/txid/${txResult.tx_id}`);
    console.log(`attempt ${count + 1} of ${countLimit}`);

    if (broadcastedResult.error) {
      console.log(`error: ${broadcastedResult.reason}`);
      console.log(`details:\n${JSON.stringify(broadcastedResult.reason_data)}`);
      return 0;
    } else {
      if (txResult.tx_status === "success") {
        return txResult.block_height;
      }
      if (txResult.tx_status === "abort_by_post_condition") {
        exitWithError(
          `tx failed, exiting...\ntxid: ${txResult.tx_id}\nhttps://explorer.stacks.co/txid/${txResult.tx_id}`
        );
      }
    }
    // pause for 30min before checking again
    await timer(300000);
    count++;
  } while (count < countLimit);

  console.log(warning(`reached retry limit, check tx`));
  console.log(`https://explorer.stacks.co/txid/${txResult.tx_id}`);
  exitWithError(
    "Unable to find target block height for next transaction, exiting..."
  );
}

/**
 * @async
 * @function getBlockHeight
 * @description Returns the current Stacks block height
 * @returns {integer}
 */
export async function getBlockHeight() {
  const url = `${STACKS_NETWORK.coreApiUrl}/v2/info`;
  const result = await fetch(url);
  const resultJson = await result.json();
  return resultJson.stacks_tip_height;
}

/**
 * @async
 * @function getStxBalance
 * @param {string} address STX address to query
 * @description Returns the current STX balance of a given address
 * @returns {integer}
 */
export async function getStxBalance(address) {
  const url = `${STACKS_NETWORK.coreApiUrl}/extended/v1/address/${address}/balances`;
  const result = await fetch(url);
  const resultJson = await result.json();
  return resultJson.stx.balance;
}

/**
 * @async
 * @function getCityCoinBalance
 * @param {string} contractAddress STX address of the contract deployer
 * @param {string} contractName Name of the contract
 * @param {string} stxAddress STX address to query
 * @returns {integer} Total balance of CityCoins
 */
export async function getCityCoinBalance(
  contractAddress,
  contractName,
  stxAddress
) {
  const resultCV = await callReadOnlyFunction({
    contractAddress: contractAddress,
    contractName: contractName,
    functionName: "get-balance",
    functionArgs: [standardPrincipalCV(stxAddress)],
    network: STACKS_NETWORK,
    senderAddress: contractAddress,
  });
  const result = cvToJSON(resultCV);
  //console.log(JSON.stringify(result));
  return parseInt(result.value.value);
}

/**
 * @async
 * @function getNonce
 * @param {string} address STX address to query
 * @description Returns the current nonce for the given address
 * @returns {integer}
 */
export async function getNonce(address) {
  const url = `${STACKS_NETWORK.coreApiUrl}/v2/accounts/${address}?proof=0`;
  const result = await safeFetch(url);
  return result.nonce;
}

/**
 * @async
 * @function getTotalMempoolTx
 * @description Returns the total number of transactions in the mempool
 * @returns {integer}
 */
export async function getTotalMempoolTx() {
  const url = `${STACKS_NETWORK.coreApiUrl}/extended/v1/tx/mempool`;
  const result = await fetch(url);
  const resultJson = await result.json();
  return resultJson.total;
}

/**
 * @async
 * @function getAccountTxs
 * @param {string} address STX address to query
 * @description Returns all account transactions for a given address or contract identifier
 * @returns {Array[]}
 */
export async function getAccountTxs(address) {
  let counter = 0;
  let total = 0;
  let limit = 50;
  let url = "";
  let txResults = [];

  // bonus points if you use your own node
  let stxApi = "https://stacks-node-api.mainnet.stacks.co";

  console.log(`getting txs for: ${address}`);

  // obtain all account transactions 50 at a time
  do {
    url = `${stxApi}/extended/v1/address/${address}/transactions?limit=${limit}&offset=${counter}`;
    const response = await fetch(url);
    if (response.status === 200) {
      // success
      const responseJson = await response.json();
      // get total number of tx
      if (total === 0) {
        total = responseJson.total;
        console.log(`Total Txs: ${total}`);
      }
      // add all transactions to main array
      responseJson.results.map((tx) => {
        txResults.push(tx);
        counter++;
      });
      // output counter
      console.log(`Processed ${counter} of ${total}`);
    } else {
      // error
      exitWithError(
        `getAccountTxs err: ${response.status} ${response.statusText}`
      );
    }
    // pause for 1sec, avoid rate limiting
    await timer(1000);
  } while (counter < total);

  // view the output
  //console.log(JSON.stringify(txResults));

  return txResults;
}

/**
 * @async
 * @function getOptimalFee
 * @param {integer} multiplier Mulitiplier for mempool average
 * @param {boolean} [checkAllTx=false] Boolean to check all transactions in mempool
 * @description Averages the fees for the first 200 transactions in the mempool, or optionally all transactions, and applies a multiplier
 * @returns {integer} Optimal fee in uSTX
 */
export async function getOptimalFee(multiplier, checkAllTx = false) {
  let counter = 0;
  let total = checkAllTx ? 0 : 200;
  let limit = 200;
  let url = "";
  let txResults = [];

  // query the stacks-node for multiple transactions
  do {
    url = `${STACKS_NETWORK.coreApiUrl}/extended/v1/tx/mempool?limit=${limit}&offset=${counter}&unanchored=true`;
    const result = await safeFetch(url);
    // get total number of tx
    if (total === 0) {
      total = result.total;
    }
    // add all transactions to main array
    result.results.map((tx) => {
      txResults.push(tx);
      counter++;
    });
    // output counter
    checkAllTx && console.log(`Processed ${counter} of ${total}`);
  } while (counter < total);

  const max = txResults
    .map((fee) => parseInt(fee.fee_rate))
    .reduce((a, b) => {
      return a > b ? a : b;
    });
  console.log(`maxFee: ${(max / USTX).toFixed(6)} STX`);
  const sum = txResults
    .map((fee) => parseInt(fee.fee_rate))
    .reduce((a, b) => a + b, 0);
  const avg = sum / txResults.length;
  console.log(`avgFee: ${(avg / USTX).toFixed(6)} STX`);

  return avg * multiplier;
}

/**
 * @async
 * @function getBlockCommit
 * @param {Object[]} userConfig An object that contains the user configuration
 * @param {Object[]} miningStrategy An object that contains properties for automatically calculating a commit
 * @description Returns a target block commit based on provided user config and mining strategy
 * @returns {integer}
 */
export async function getBlockCommit(userConfig, miningStrategy) {
  console.log(`strategyDistance: ${miningStrategy.strategyDistance}`);
  // get current block height
  const currentBlock = await getBlockHeight().catch((err) =>
    exitWithError(`getBlockHeight err: ${err}`)
  );
  // get average block commit for past blocks based on strategy distance
  const avgPast = await getBlockAvg(
    -1,
    currentBlock,
    miningStrategy,
    userConfig
  ).catch((err) => exitWithError(`getBlockAvg err: ${err}`));
  console.log(`avgPast: ${(avgPast / USTX).toFixed(6)} STX`);
  const commitPast = parseInt(
    avgPast * (miningStrategy.targetPercentage / 100)
  );
  // get average block commit for future blocks based on strategy distance
  const avgFuture = await getBlockAvg(
    1,
    currentBlock,
    miningStrategy,
    userConfig
  ).catch((err) => exitWithError(`getBlockAvg err: ${err}`));
  console.log(`avgFuture: ${(avgFuture / USTX).toFixed(6)} STX`);
  const commitFuture = parseInt(
    avgFuture * (miningStrategy.targetPercentage / 100)
  );
  // set commit amount by averaging past and future values
  const commitAmount = (commitPast + commitFuture) / 2;
  return commitAmount.toFixed();
}

/**
 * @async
 * @function getBlockAvg
 * @param {Object[]} userConfig An object that contains the user configuration
 * @description Returns the average block commit for strategyDistance blocks in the past/future
 * @returns {integer}
 */
async function getBlockAvg(
  direction,
  currentBlock,
  miningStrategy,
  userConfig
) {
  const targetBlock =
    currentBlock + miningStrategy.strategyDistance * direction;
  const blockStats = [];

  for (
    let i = currentBlock;
    direction > 0 ? i < targetBlock : i > targetBlock;
    direction > 0 ? i++ : i--
  ) {
    const result = await getMiningStatsAtBlock(
      userConfig.contractAddress,
      userConfig.contractName,
      i
    );
    blockStats.push(result);
    // avoid API rate limiting
    await timer(1000);
  }

  const sum = blockStats.reduce((a, b) => parseInt(a) + parseInt(b), 0);
  const avg = sum / miningStrategy.strategyDistance;

  return avg;
}

/**
 * @async
 * @function getMiningStatsAtBlock
 * @param {string} contractAddress STX address of the contract deployer
 * @param {string} contractName Name of the contract
 * @param {integer} blockHeight Block height to query
 * @description Returns the total amount of STX sent for a given block height in the specified contracts
 * @returns {integer}
 */
async function getMiningStatsAtBlock(
  contractAddress,
  contractName,
  blockHeight
) {
  const resultCV = await callReadOnlyFunction({
    contractAddress: contractAddress,
    contractName: contractName,
    functionName: "get-mining-stats-at-block-or-default",
    functionArgs: [uintCV(blockHeight)],
    network: STACKS_NETWORK,
    senderAddress: contractAddress,
  });
  const result = cvToJSON(resultCV);
  return result.value.amount.value;
}

/**
 * @async
 * @function getStackerAtCycleOrDefault
 * @param {string} contractAddress STX address of the contract deployer
 * @param {string} contractName Name of the contract
 * @param {integer} cycleId Reward cycle to query
 * @param {integer} userId User ID to query
 * @description Returns the amount stacked and amount to return for a given cycle and user
 * @returns {Object[]}
 */
export async function getStackerAtCycleOrDefault(
  contractAddress,
  contractName,
  cycleId,
  userId
) {
  const resultCv = await callReadOnlyFunction({
    contractAddress: contractAddress,
    contractName: contractName,
    functionName: "get-stacker-at-cycle-or-default",
    functionArgs: [uintCV(cycleId), uintCV(userId)],
    network: STACKS_NETWORK,
    senderAddress: contractAddress,
  });
  const result = cvToJSON(resultCv);
  return result;
}

/**
 * @async
 * @function getStackingReward
 * @param {string} contractAddress STX address of the contract deployer
 * @param {string} contractName Name of the contract
 * @param {integer} cycleId Reward cycle to query
 * @param {integer} userId User ID to query
 * @description Returns the amount of STX a user can claim in a given reward cycle in uSTX.
 * @returns {integer}
 */
export async function getStackingReward(
  contractAddress,
  contractName,
  cycleId,
  userId
) {
  const resultCv = await callReadOnlyFunction({
    contractAddress: contractAddress,
    contractName: contractName,
    functionName: "get-stacking-reward",
    functionArgs: [uintCV(userId), uintCV(cycleId)],
    network: STACKS_NETWORK,
    senderAddress: contractAddress,
  });
  const result = cvToJSON(resultCv);
  return parseInt(result.value);
}

/**
 * @async
 * @function getUserId
 * @param {string} contractAddress STX address of the contract deployer
 * @param {string} contractName Name of the contract
 * @param {string} address Stacks address to query
 * @description Returns the userId in the CityCoin contract for a given address
 * @returns {integer}
 */
export async function getUserId(contractAddress, contractName, address) {
  const resultCv = await callReadOnlyFunction({
    contractAddress: contractAddress,
    contractName: contractName,
    functionName: "get-user-id",
    functionArgs: [standardPrincipalCV(address)],
    network: STACKS_NETWORK,
    senderAddress: contractAddress,
  });
  const result = cvToValue(resultCv);
  return parseInt(result.value);
}

/**
 * @async
 * @function getRewardCycle
 * @param {string} contractAddress STX address of the contract deployer
 * @param {string} contractName Name of the contract
 * @param {integer} blockHeight Block height to query
 * @description Returns the reward cycle for a given block height
 * @returns {integer}
 */
export async function getRewardCycle(
  contractAddress,
  contractName,
  blockHeight
) {
  const resultCv = await callReadOnlyFunction({
    contractAddress: contractAddress,
    contractName: contractName,
    functionName: "get-reward-cycle",
    functionArgs: [uintCV(blockHeight)],
    network: STACKS_NETWORK,
    senderAddress: contractAddress,
  });
  const result = cvToJSON(resultCv);
  return parseInt(result.value.value);
}

/**
 * @async
 * @function canClaimMiningReward
 * @param {string} contractAddress
 * @param {string} contractName
 * @param {string} address
 * @param {integer} blockHeight
 * @description Returns true if the user can claim a reward for a given block height
 * @returns {bool}
 */
export async function canClaimMiningReward(
  contractAddress,
  contractName,
  address,
  blockHeight
) {
  const resultCv = await callReadOnlyFunction({
    contractAddress: contractAddress,
    contractName: contractName,
    functionName: "can-claim-mining-reward",
    functionArgs: [standardPrincipalCV(address), uintCV(blockHeight)],
    network: STACKS_NETWORK,
    senderAddress: contractAddress,
  });
  const result = cvToJSON(resultCv);
  return result.value;
}

/**
 * @function printDivider
 * @description Prints a consistent divider used for logging
 */
export function printDivider() {
  console.log(`-------------------------`);
}

/**
 * @function printTimeStamp
 * @description Prints a consistent timestamp used for logging
 */
export function printTimeStamp() {
  let newDate = new Date().toLocaleString();
  newDate = newDate.replace(/,/g, "");
  console.log(newDate);
}

/**
 * @function exitWithSuccess
 * @param {string} message
 * @description Prints a final message and exits the running script
 */
export function exitWithSuccess(message) {
  console.log(success(message));
  process.exit(1);
}

/**
 * @function exitWithError
 * @param {string} message
 * @description Prints an error message and exits the running script
 */
export function exitWithError(message) {
  console.log(err(message));
  process.exit(1);
}

/**
 * @async
 * @function waitUntilBlock
 * @param {Object[]} userConfig An object that contains the user configuration
 * @returns {boolean}
 */
export async function waitUntilBlock(userConfig) {
  // config
  var init = true;
  var currentBlock = 0;
  // loop until target block is reached
  do {
    if (init) {
      init = !init;
    } else {
      if (userConfig.targetBlockHeight - currentBlock > 25) {
        // over 25 blocks (4 hours / 240 minutes)
        // check every 2hr
        await timer(7200000);
      } else if (userConfig.targetBlockHeight - currentBlock > 5) {
        // between 5-25 blocks (50 minutes - 4 hours)
        // check every 30min
        await timer(1800000);
      } else {
        // less than 5 blocks (50 minutes)
        // check every 5min
        await timer(300000);
      }
    }

    printDivider();
    console.log(title(`STATUS: WAITING FOR TARGET BLOCK`));
    printDivider();
    printTimeStamp();
    console.log(
      `account: ${userConfig.stxAddress.slice(
        0,
        5
      )}...${userConfig.stxAddress.slice(userConfig.stxAddress.length - 5)}`
    );

    currentBlock = await getBlockHeight().catch((err) =>
      exitWithError(`getBlockHeight err: ${err}`)
    );
    console.log(`currentBlock: ${currentBlock}`);
    console.log(`targetBlock: ${userConfig.targetBlockHeight}`);
    if (currentBlock < userConfig.targetBlockHeight) {
      console.log(
        `distance: ${userConfig.targetBlockHeight - currentBlock} blocks to go`
      );
      const remainingTime =
        ((userConfig.targetBlockHeight - currentBlock) * 10) / 60;
      if (remainingTime >= 1) {
        console.log(`time: ${remainingTime.toFixed(2)} hours`);
      } else {
        console.log(`time: ${(remainingTime * 60).toFixed()} minutes`);
      }
    }

    const mempoolTxCount = await getTotalMempoolTx().catch((err) =>
      exitWithError(`getTotalMempoolTx err: ${err}`)
    );
    console.log(`mempoolTxCount: ${mempoolTxCount}`);
  } while (userConfig.targetBlockHeight > currentBlock);

  return true;
}

/**
 * @async
 * @function promptFeeStrategy
 * @description Prompts the user for a custom fee multiplier
 * @returns {Object[]} An object that contains the value for the fee multiplier
 */
export async function promptFeeStrategy() {
  const feeMultiplier = await prompts(
    {
      type: "number",
      name: "value",
      message: "Fee multiplier for tx in mempool? (default: 1)",
      validate: (value) => (value > 0 ? true : "Value must be greater than 0"),
    },
    {
      onCancel: cancelPrompt,
    }
  );
  return feeMultiplier;
}
