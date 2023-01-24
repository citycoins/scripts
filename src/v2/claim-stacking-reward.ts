import { address } from "bitcoinjs-lib";
import { callReadOnlyFunction, fetchReadOnlyFunction } from "micro-stacks/api";
import { principalCV, uintCV } from "micro-stacks/clarity";
import {
  AnchorMode,
  createAssetInfo,
  FungibleConditionCode,
  makeContractFungiblePostCondition,
  makeContractSTXPostCondition,
  makeStandardSTXPostCondition,
  PostConditionMode,
} from "micro-stacks/transactions";
import prompts from "prompts";
import {
  getFullCityConfig,
  getRewardCycle,
  selectCityVersion,
} from "../../lib/citycoins";
import {
  DEFAULT_FEE,
  deriveChildAccount,
  getStacksBlockHeight,
  getNonce,
  NETWORK,
  submitTx,
} from "../../lib/stacks";
import {
  cancelPrompt,
  disclaimerIntro,
  exitError,
  exitSuccess,
  fixBigInt,
  fromMicro,
  getUserConfig,
  printAddress,
  printDivider,
  sleep,
} from "../../lib/utils";

async function getScriptConfig() {
  printDivider();
  console.log("SETTING SCRIPT CONFIGURATION");
  printDivider();

  const scriptConfig = await prompts(
    [
      {
        type: "number",
        name: "startCycle",
        message: "Start cycle to claim rewards for?",
        validate: (value) =>
          value < 1 ? "Value must be greater than 0" : true,
      },
      {
        type: "number",
        name: "endCycle",
        message: "End cycle to claim rewards for?",
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

async function claimStackingRewards(userConfig: any, scriptConfig: any) {
  printDivider();
  console.log(`CLAIMING SELECTED CYCLES`);
  printDivider();
  printAddress(userConfig.address);
  console.log(`startCycle: ${scriptConfig.startCycle}`);
  console.log(`endCycle: ${scriptConfig.endCycle}`);
  console.log(
    `totalCycles: ${scriptConfig.endCycle - scriptConfig.startCycle}`
  );
  // get current block height
  const currentBlockHeight = await getStacksBlockHeight(userConfig.network);
  // get info for transactions
  const { address, key } = await deriveChildAccount(
    userConfig.network,
    userConfig.mnemonic,
    userConfig.accountIndex
  );
  let nonce = await getNonce(userConfig.network, userConfig.address);
  console.log(`nonce: ${nonce}`);
  const cityConfig = await getFullCityConfig(userConfig.citycoin.toLowerCase());
  const version = await selectCityVersion(
    userConfig.citycoin.toLowerCase(),
    currentBlockHeight
  );
  if (version === "")
    exitError(`Error: no version found for ${userConfig.citycoin}`);
  // get user ID for claims
  const userId = Number(
    await fetchReadOnlyFunction(
      {
        contractAddress: cityConfig[version].deployer,
        contractName: cityConfig[version].core.name,
        functionName: "get-user-id",
        functionArgs: [principalCV(address)],
        network: NETWORK(userConfig.network),
        senderAddress: address,
      },
      true
    ).catch(() => exitError(`User ID not found for ${address}, exiting...`))
  );
  console.log(`userId: ${userId}`);
  // max tx in mempool at one time
  const claimLimit = 25;
  // iterate over each cycle to claim
  let counter = 0;
  for (let i = scriptConfig.startCycle; i <= scriptConfig.endCycle; i++) {
    printDivider();
    console.log(`claiming cycle ${i}`);
    console.log(`nonce: ${nonce}`);
    const stackingReward = Number(
      await fetchReadOnlyFunction(
        {
          contractAddress: cityConfig[version].deployer,
          contractName: cityConfig[version].core.name,
          functionName: "get-stacking-reward",
          functionArgs: [uintCV(userId), uintCV(i)],
          network: NETWORK(userConfig.network),
          senderAddress: address,
        },
        true
      ).catch(() => 0)
    );
    console.log(`stackingReward: ${JSON.stringify(stackingReward)}`);
    const stackerInfo: StackerAtCycle = await fetchReadOnlyFunction(
      {
        contractAddress: cityConfig[version].deployer,
        contractName: cityConfig[version].core.name,
        functionName: "get-stacker-at-cycle-or-default",
        functionArgs: [uintCV(i), uintCV(userId)],
        network: NETWORK(userConfig.network),
        senderAddress: address,
      },
      true
    );
    console.log(`toReturn: ${stackerInfo.toReturn}`);
    if (stackingReward === 0 && stackerInfo.toReturn === 0) {
      console.log(`no rewards, skipping...`);
      continue;
    }
    // build post conditions
    let postConditions = [];
    if (stackingReward > 0)
      postConditions.push(
        makeContractSTXPostCondition(
          cityConfig[version].deployer,
          cityConfig[version].core.name,
          FungibleConditionCode.Equal,
          stackingReward
        )
      );
    if (stackerInfo.toReturn > 0)
      postConditions.push(
        makeContractFungiblePostCondition(
          cityConfig[version].deployer,
          cityConfig[version].core.name,
          FungibleConditionCode.Equal,
          stackerInfo.toReturn,
          createAssetInfo(
            cityConfig[version].deployer,
            cityConfig[version].token.name,
            cityConfig[version].token.tokenName
          )
        )
      );
    // build tx
    const txOptions = {
      contractAddress: cityConfig[version].deployer,
      contractName: cityConfig[version].core.name,
      functionName: "claim-stacking-reward",
      functionArgs: [uintCV(i)],
      senderKey: key,
      fee: scriptConfig.feeAmount,
      nonce: nonce,
      postConditionMode: PostConditionMode.Deny,
      postConditions: postConditions,
      network: NETWORK(userConfig.network),
      anchorMode: AnchorMode.Any,
    };
    await submitTx(txOptions, userConfig.network);
    if (counter >= claimLimit) {
      exitSuccess("claim limit reached, exiting...");
    }
    counter++;
    nonce++;
    console.log(`counter: ${counter} of ${claimLimit}`);

    // avoid rate limiting
    await sleep(500);
  }

  // await claimStackingRewards(userConfig, scriptConfig);
}

interface StackerAtCycle {
  amountStacked: number;
  toReturn: number;
}

async function main() {
  disclaimerIntro(
    "Claim Stacking Rewards",
    "Builds and submits claim-stacking-reward transactions for a given range of block heights.",
    true
  );
  const userConfig = await getUserConfig();
  const scriptConfig = await getScriptConfig();
  await claimStackingRewards(userConfig, scriptConfig);
  printDivider();
  exitSuccess("all actions complete, script exiting...");
}

main();
