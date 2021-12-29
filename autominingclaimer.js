import BN from "bn.js";
import prompts from "prompts";
import {
  cancelPrompt,
  getBlockHeight,
  printDivider,
  printTimeStamp,
  timer,
  USTX,
  title,
  exitWithError,
  getNonce,
  STACKS_NETWORK,
  canClaimMiningReward,
  safeFetch,
  warn,
} from "./utils.js";
import {
  uintCV,
  PostConditionMode,
  makeContractCall,
  broadcastTransaction,
} from "@stacks/transactions";

/** @module AutoMiningClaimer */

/**
 * @constant
 * @type {integer}
 * @description Default fee to use when no custom fee is set
 * @default
 */
const defaultFee = 50000;

/**
 * @async
 * @function promptUserConfig
 * @description Prompts the user for configuration options at the start of the script
 * @returns {Object[]} An object that contains properties for each question name and related answers as a values
 */
async function promptUserConfig() {
  const questions = [
    {
      type: "select",
      name: "citycoin",
      message: "Select a CityCoin to look up mining claims:",
      choices: [
        { title: "MiamiCoin (MIA)", value: "MIA" },
        { title: "NewYorkCityCoin (NYC)", value: "NYC" },
      ],
    },
    {
      type: "text",
      name: "stxAddress",
      message: "Stacks Address to claim with?",
      validate: (value) => (value === "" ? "Stacks address is required" : true),
    },
    {
      type: "password",
      name: "stxPrivateKey",
      message: "Private Key for Stacks Address?",
      validate: (value) =>
        value === "" ? "Stacks private key is required" : true,
    },
    {
      type: "confirm",
      name: "customFee",
      message: `Set custom fee? (default ${(defaultFee / USTX).toFixed(
        6
      )} STX)`,
    },
    {
      type: (prev) => (prev ? "number" : null),
      name: "customFeeValue",
      message: "Custom fee value in uSTX? (1,000,000 uSTX = 1 STX)",
      validate: (value) => (value > 0 ? true : "Value must be greater than 0"),
    },
  ];
  const submit = (prompt, answer, answers) => {
    if (prompt.name === "citycoin") {
      switch (answer) {
        case "MIA":
          answers.contractAddress = "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27";
          answers.contractName = "miamicoin-core-v1";
          answers.blockWinnersUrl = "https://miamining.com/winners";
          break;
        case "NYC":
          answers.contractAddress = "SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5";
          answers.contractName = "newyorkcitycoin-core-v1";
          answers.blockWinnersUrl = "https://mining.nyc/winners";
          break;
      }
    }
  };
  const userConfig = await prompts(questions, {
    onCancel: cancelPrompt,
    onSubmit: submit,
  });
  return userConfig;
}

async function autoMiningClaimer(userConfig) {
  printDivider();
  printTimeStamp();

  const currentBlockHeight = await getBlockHeight().catch((err) =>
    exitWithError(`getBlockHeight err: ${err}`)
  );
  console.log(`currentBlockHeight: ${currentBlockHeight}`);

  const blockWinners = await safeFetch(userConfig.blockWinnersUrl);

  // get all blocks won from Jamils explorer
  const blocksWon = [];
  const blocksUnclaimed = [];
  for (const block in blockWinners) {
    if (blockWinners[block].miner === userConfig.stxAddress) {
      blocksWon.push(block);
      if (!blockWinners[block].claimed) {
        blocksUnclaimed.push(block);
      }
    }
  }

  // double-check that blocksUnclaimed is accurate by querying the contract for each block height
  console.log(`Checking unclaimed blocks...`);
  const blocksUnclaimedCheck = await Promise.all(
    blocksUnclaimed.map(async (block) => {
      // pause between requests
      await timer(1000);
      // check if user can claim mining reward
      return canClaimMiningReward(
        userConfig.contractAddress,
        userConfig.contractName,
        userConfig.stxAddress,
        block
      ).catch((err) => exitWithError(`canClaimMiningReward err: ${err}`));
    })
  );

  const blocksFiltered = blocksUnclaimed.filter(
    (value, idx) => blocksUnclaimedCheck[idx]
  );

  console.log(`Total blocks to claim: ${blocksFiltered.length}`);

  printDivider();
  console.log(title("STATUS: CLAIMING MINING REWARDS"));

  // get the current nonce
  let nonce = await getNonce(userConfig.stxAddress).catch((err) =>
    exitWithError(`getNonce err: ${err}`)
  );

  const counterLimit = blocksFiltered.length < 24 ? blocksFiltered.length : 24;
  for (let i = 0; i < counterLimit; i++) {
    printDivider();
    console.log(
      `account: ${userConfig.stxAddress.slice(
        0,
        5
      )}...${userConfig.stxAddress.slice(userConfig.stxAddress.length - 5)}`
    );
    console.log(`nonce: ${nonce}`);
    console.log(`claiming block: ${blocksFiltered[i]}`);
    // create the claim tx
    const txOptions = {
      contractAddress: userConfig.contractAddress,
      contractName: userConfig.contractName,
      contractFunction: "claim-mining-reward",
      functionArgs: [uintCV(blocksFiltered[i])],
      senderKey: userConfig.stxPrivateKey,
      fee: new BN(
        userConfig.hasOwnProperty("customFeeValue")
          ? customFeeValue
          : defaultFee
      ),
      nonce: new BN(nonce),
      postConditionMode: PostConditionMode.Deny,
      postConditions: [],
      network: STACKS_NETWORK,
    };

    // pause 2sec
    console.log(`pausing 2sec before submit`);
    await timer(2000);

    // submit the tx
    const transaction = await makeContractCall(txOptions).catch((err) =>
      exitWithError(`makeContractCall err: ${err}`)
    );
    console.log(`https://explorer.stacks.co/txid/${transaction.txid()}`);
    await broadcastTransaction(transaction, STACKS_NETWORK).catch((err) =>
      exitWithError(`broadcastTransaction err: ${err}`)
    );
  }
}

// show title and disclaimer on first run
printDivider();
console.log(title("CITYCOINS AUTOMININGCLAIMER"));
printDivider();
console.log(
  "This utility provides a simple, easy-to-use, prompt-driven interface for checking if an address won any blocks, and if so, automatically submits the claim transaction.\n"
);
console.log(
  "THIS IS ALPHA SOFTWARE THAT REQUIRES A STACKS PRIVATE KEY TO SEND A TRANSACTION.\n"
);
console.log("THE CODE IS FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY.\n");
console.log(warn("USE AT YOUR OWN RISK. PLEASE REPORT ANY ISSUES ON GITHUB."));

// get the user config and start the AutoClaimer
printDivider();
console.log(title("STATUS: SETTING USER CONFIG"));
printDivider();
promptUserConfig().then((answers) => autoMiningClaimer(answers));
