import "cross-fetch/polyfill";
import prompts from "prompts";
import { uintCV } from "micro-stacks/clarity";
import { AnchorMode, PostConditionMode } from "micro-stacks/transactions";
import {
  cancelPrompt,
  disclaimerIntro,
  exitError,
  exitSuccess,
  fromMicro,
  printAddress,
  printDivider,
  getUserConfig,
  sleep,
} from "../../lib/utils";
import {
  DEFAULT_FEE,
  deriveChildAccount,
  getNonce,
  getStacksBlockHeight,
  NETWORK,
  submitTx,
} from "../../lib/stacks";
import {
  canClaimMiningReward,
  getFullCityConfig,
  selectCityVersion,
} from "../../lib/citycoins";

async function getScriptConfig() {
  printDivider();
  console.log("SETTING SCRIPT CONFIGURATION");
  printDivider();

  // prompt for script configuration
  const scriptConfig = await prompts(
    [
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
        name: "feeAmount",
        message: "Custom fee value in uSTX? (1,000,000 uSTX = 1 STX)",
        validate: (value) =>
          value > 0 ? true : "Value must be greater than 0",
      },
    ],
    {
      onCancel: (prompt: any) => cancelPrompt(prompt.name),
    }
  );

  // if custom fee, confirm fee amount
  if (scriptConfig.customFee) {
    const confirmFee = await prompts(
      {
        type: "toggle",
        name: "confirm",
        message: `Confirm custom tx fee? (${fromMicro(
          scriptConfig.feeAmount
        )} STX)`,
        initial: false,
        active: "Yes",
        inactive: "No",
      },
      { onCancel: (prompt: any) => cancelPrompt(prompt.name) }
    );
    printDivider();
    if (!confirmFee) exitError("Custom fee amount not confirmed, exiting...");
  } else {
    // else set default fee
    scriptConfig.feeAmount = DEFAULT_FEE;
  }

  console.log(`feeAmount: ${fromMicro(scriptConfig.feeAmount)} STX`);

  return scriptConfig;
}

async function claimMiningRewards(userConfig: any, scriptConfig: any) {
  printDivider();
  console.log("SCANNING SELECTED BLOCKS");
  printDivider();
  // get current block height
  const currentBlockHeight = await getStacksBlockHeight();
  // validate start/end block heights
  if (scriptConfig.startBlock > scriptConfig.endBlock) {
    exitError("Start block must be less than end block");
  }
  if (scriptConfig.endBlock > currentBlockHeight - 100) {
    exitError("End block must be less than 100 blocks before current block");
  }
  printAddress(userConfig.address);
  console.log(`startBlock: ${scriptConfig.startBlock}`);
  console.log(`endBlock: ${scriptConfig.endBlock}`);
  console.log(
    `totalBlocks: ${scriptConfig.endBlock - scriptConfig.startBlock + 1}`
  );
  // get info for transactions
  const { key } = await deriveChildAccount(
    userConfig.mnemonic,
    userConfig.accountIndex
  );
  const cityConfig = await getFullCityConfig(userConfig.citycoin.toLowerCase());
  let nonce = await getNonce(userConfig.address);
  console.log(`nonce: ${nonce}`);
  // max tx in mempool at one time
  const claimLimit = 25;
  // iterate over each block to claim
  let counter = 0;
  for (let i = scriptConfig.startBlock; i <= scriptConfig.endBlock; i++) {
    // find contract version based on block height
    printDivider();
    const version = await selectCityVersion(
      userConfig.citycoin.toLowerCase(),
      i
    );
    if (version === "") {
      continue;
    }
    /* TODO: update with testnet API call
    // check canClaimMiningReward for block
    const canClaim = await canClaimMiningReward(
      version,
      userConfig.citycoin,
      i,
      userConfig.address
    );
    console.log(`block ${i}, ${version}, ${canClaim}`);
    */

    // if (canClaim) {
    const txOptions = {
      contractAddress: cityConfig[version].deployer,
      contractName: cityConfig[version].core.name,
      functionName: "claim-mining-reward",
      functionArgs: [uintCV(i)],
      senderKey: key,
      fee: scriptConfig.feeAmount,
      nonce: nonce,
      postConditionMode: PostConditionMode.Deny,
      postConditions: [],
      network: NETWORK(userConfig.network),
      anchorMode: AnchorMode.Any,
    };
    console.log(`claiming block: ${i}`);
    await submitTx(txOptions, userConfig.network);
    if (counter >= claimLimit) {
      exitSuccess("claim limit reached, exiting...");
    }
    counter++;
    nonce++;
    console.log(`counter: ${counter} of ${claimLimit}`);
    console.log(`nonce: ${nonce}`);
    // }

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
  const userConfig = await getUserConfig();
  const scriptConfig = await getScriptConfig();
  await claimMiningRewards(userConfig, scriptConfig);
  printDivider();
  exitSuccess("all actions complete, script exiting...");
}

main();
