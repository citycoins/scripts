import "cross-fetch/polyfill";
import prompts from "prompts";
import {
  cancelPrompt,
  disclaimerIntro,
  exitError,
  exitSuccess,
  fromMicro,
  printAddress,
  printDivider,
  setAddressConfig,
  setUserConfig,
  sleep,
} from "../../lib/utils";
import {
  getNonce,
  getStacksBlockHeight,
  STACKS_NETWORK,
} from "../../lib/stacks";
import { validateStacksAddress } from "micro-stacks/crypto";
import {
  canClaimMiningReward,
  getFullCityConfig,
  selectCityVersion,
} from "../../lib/citycoins";
import { uintCV } from "micro-stacks/clarity";
import {
  AnchorMode,
  broadcastTransaction,
  makeContractCall,
  PostConditionMode,
} from "micro-stacks/transactions";

const DEFAULT_FEE = 50000; // 0.05 STX per TX

/*
async function setUserConfig() {
  printDivider();
  console.log("SETTING CONFIGURATION");
  printDivider();
  // prompt for user config
  const userConfig = await prompts(
    [
      {
        type: "select",
        name: "citycoin",
        message: "Select a CityCoin to claim mining rewards:",
        choices: [
          { title: "MiamiCoin (MIA)", value: "MIA" },
          { title: "NewYorkCityCoin (NYC)", value: "NYC" },
        ],
      },
      {
        type: "text",
        name: "stxSender",
        message: "Stacks Address to claim with?",
        validate: (value: string) =>
          validateStacksAddress(value)
            ? true
            : "Valid Stacks address is required",
      },
      {
        type: "password",
        name: "stxPrivateKey",
        message: "Private Key for Stacks address?",
        validate: (value: string) =>
          value === "" ? "Stacks private key is required" : true,
      },
      {
        type: "number",
        name: "startBlock",
        message: "Start block to claim from?",
        validate: (value) =>
          value < 1 ? "Value must be greater than 0" : true,
      },
      {
        type: "number",
        name: "endBlock",
        message: "End block to claim to?",
        validate: (value) =>
          value < 1 ? "Value must be greater than 0" : true,
      },
      {
        type: "toggle",
        name: "customFee",
        message: `Set custom fee per TX?`,
        initial: false,
        active: "Yes",
        inactive: "No",
      },
      {
        type: (prev) => (prev ? "number" : null),
        name: "customFeeValue",
        message: "Custom fee value in uSTX? (1,000,000 uSTX = 1 STX)",
        validate: (value) =>
          value > 0 ? true : "Value must be greater than 0",
      },
    ],
    {
      onCancel: (prompt: any) => cancelPrompt(prompt.name),
    }
  );
  return userConfig;
}
*/
async function setStrategy(config: any) {
  printDivider();
  console.log("CALCULATING FEE AMOUNT");
  printDivider();

  let feeAmount = 0;

  // if custom fee, confirm fee amount
  if (config.customFee) {
    const confirmFee = await prompts(
      {
        type: "toggle",
        name: "confirm",
        message: `Confirm custom tx fee? (${fromMicro(
          config.customFeeValue
        )} STX)`,
        initial: false,
        active: "Yes",
        inactive: "No",
      },
      { onCancel: (prompt: any) => cancelPrompt(prompt.name) }
    );
    printDivider();
    if (!confirmFee) exitError("Custom fee amount not confirmed, exiting...");
    feeAmount = config.customFeeValue;
  } else {
    // else get strategy info to set fee amount
    /*
    // REMOVING FOR NOW - CHEAPER TO HARD CODE
    // SINCE THESE AREN'T HIGH PRIORITY OR 
    // COMPETETIVE LIKE MINING TRANSACTIONS
    const feeMultiplier = await prompts(
      {
        type: "number",
        name: "value",
        message: "Fee multiplier for tx in mempool? (default: 1)",
        validate: (value) =>
          value > 0 ? true : "Value must be greater than 0",
      },
      { onCancel: (prompt: any) => cancelPrompt(prompt.name) }
    );
    printDivider();
    // set fee amount based on strategy
    feeAmount = await getOptimalFee(feeMultiplier.value);
    */
    feeAmount = DEFAULT_FEE;
  }
  console.log(`feeAmount: ${fromMicro(feeAmount)} STX`);

  const strategy = {
    feeAmount: feeAmount,
  };

  return strategy;
}

async function claimMiningRewards(config: any, strategy: any) {
  // get current block height
  const currentBlockHeight = await getStacksBlockHeight();
  // validate start/end block heights
  if (config.startBlock > config.endBlock) {
    exitError("Start block must be less than end block");
  }
  if (config.endBlock > currentBlockHeight - 100) {
    exitError("End block must be less than 100 blocks before current block");
  }
  // show info based on config
  printDivider();
  console.log("SCANNING SELECTED BLOCKS");
  printDivider();
  printAddress(config.stxSender);
  console.log(`startBlock: ${config.startBlock}`);
  console.log(`endBlock: ${config.endBlock}`);
  console.log(`totalBlocks: ${config.endBlock - config.startBlock + 1}`);
  // get info for transactions
  const cityConfig = await getFullCityConfig(config.citycoin.toLowerCase());
  let nonce = await getNonce(config.stxSender);
  console.log(`nonce: ${nonce}`);
  // max tx in mempool at one time
  const claimLimit = 25;
  // iterate over each block to claim
  let counter = 0;
  for (let i = config.startBlock; i <= config.endBlock; i++) {
    // find contract version based on block height
    printDivider();
    const version = await selectCityVersion(config.citycoin.toLowerCase(), i);
    if (version === "") {
      continue;
    }
    // check canClaimMiningReward for block
    const canClaim = await canClaimMiningReward(
      version,
      config.citycoin,
      i,
      config.stxSender
    );
    console.log(`block ${i}, ${version}, ${canClaim}`);
    if (canClaim) {
      const txOptions = {
        contractAddress: cityConfig[version].deployer,
        contractName: cityConfig[version].core.name,
        functionName: "claim-mining-reward",
        functionArgs: [uintCV(i)],
        senderKey: config.stxPrivateKey,
        fee: strategy.feeAmount,
        nonce: nonce,
        postConditionMode: PostConditionMode.Deny,
        postConditions: [],
        network: STACKS_NETWORK,
        anchorMode: AnchorMode.Any,
      };
      try {
        const transaction = await makeContractCall(txOptions);
        const broadcastResult = await broadcastTransaction(
          transaction,
          STACKS_NETWORK
        );
        if ("error" in broadcastResult) {
          console.log(`error: ${broadcastResult.reason}`);
          console.log(
            `details:\n${JSON.stringify(broadcastResult.reason_data)}`
          );
          exitError("Error broadcasting transaction, exiting...");
        }
        console.log(
          `link: https://explorer.stacks.co/txid/${transaction.txid()}`
        );
        if (counter >= claimLimit) {
          exitSuccess("claim limit reached, exiting...");
        }
        counter++;
        nonce++;
        console.log(`counter: ${counter} of ${claimLimit}`);
        console.log(`nonce: ${nonce}`);
      } catch (err) {
        exitError(String(err));
      }
    }
    // avoid rate limiting
    await sleep(500);
  }
}

async function main() {
  disclaimerIntro(
    "Claim Mining Rewards",
    "Builds and submits claim-mining-reward transactions for a given range of block heights.",
    true
  );
  // get network and citycoin selection
  const userConfig = await setUserConfig();
  console.log(JSON.stringify(userConfig, null, 2));
  const addressConfig = await setAddressConfig(userConfig);
  console.log(JSON.stringify(addressConfig, null, 2));
  /*
  const strategy = await setStrategy(config);
  await claimMiningRewards(config, strategy);
  */
  printDivider();
  exitSuccess("all actions complete, script exiting...");
}

main();
