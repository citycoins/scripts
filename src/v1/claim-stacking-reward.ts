import prompts from "prompts";
import { validateStacksAddress } from "micro-stacks/crypto";
import {
  cancelPrompt,
  disclaimerIntro,
  exitError,
  exitSuccess,
  fromMicro,
  printAddress,
  printDivider,
} from "../../lib/utils";
import { getNonce, getStacksBlockHeight } from "../../lib/stacks";
import {
  getCityInfo,
  getFullCityConfig,
  getRewardCycle,
  getStackerAtCycle,
  getStackingReward,
  getUserId,
  UserIds,
} from "../../lib/citycoins";

const DEFAULT_FEE = 50000; // 0.05 STX per TX

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
        message: "Select a CityCoin to claim stacking rewards:",
        choices: [
          { title: "MiamiCoin (MIA)", value: "MIA" },
          { title: "NewYorkCityCoin (NYC)", value: "NYC" },
        ],
      },
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
        name: "startCycle",
        message: "Start cycle to claim from?",
        validate: (value) =>
          value < 1 ? "Value must be greater than 0" : true,
      },
      {
        type: "number",
        name: "endCycle",
        message: "End cycle to claim to?",
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
    feeAmount = DEFAULT_FEE;
  }
  console.log(`feeAmount: ${fromMicro(feeAmount)} STX`);

  const strategy = {
    feeAmount: feeAmount,
  };

  return strategy;
}

async function claimStackingRewards(config: any, strategy: any) {
  // get city info
  const cityInfo = await getCityInfo(config.citycoin.toLowerCase());
  // get current version
  const [currentVersion] = cityInfo.versions.slice(-1);
  // get current block height
  const currentBlockHeight = await getStacksBlockHeight(config.network);
  // get current reward cycle
  const currentCycle = await getRewardCycle(
    currentVersion,
    config.citycoin.toLowerCase(),
    currentBlockHeight
  );
  // validate start/end cycles
  if (config.startCycle > config.endCycle) {
    exitError("Start cycle must be less than end cycle, exiting...");
  }
  if (config.startCycle >= currentCycle) {
    exitError("Start cycle must be less than current cycle, exiting...");
  }
  // show info based on config
  printDivider();
  console.log("SCANNING SELECTED CYCLES");
  printDivider();
  printAddress(config.stxSender);
  console.log(`startCycle: ${config.startCycle}`);
  console.log(`endCycle: ${config.endCycle}`);
  console.log(`totalCycles: ${config.endCycle - config.startCycle + 1}`);
  // get CityCoin user IDs
  const userIds: UserIds = {};
  for (const version of cityInfo.versions) {
    console.log(`version: ${version}`);
    const id = await getUserId(
      version,
      config.citycoin.toLowerCase(),
      config.stxSender
    ).catch(() => 0);
    userIds[version] = id;
  }
  // get info for transactions
  const cityConfig = await getFullCityConfig(config.citycoin.toLowerCase());
  let nonce = await getNonce(config.network, config.stxSender);
  console.log(`nonce: ${nonce}`);
  // max tx in mempool at one time
  const claimLimit = 25;
  // iterate over each block to claim
  let counter = 0;
  for (let i = config.startCycle; i <= config.endCycle; i++) {
    if (i >= currentCycle) {
      printDivider();
      exitError(
        `Cannot query current or future cycles (${currentCycle}), exiting...`
      );
    }
    printDivider();
    // query all contract versions for cycle claims
    for (const version of cityInfo.versions) {
      let canClaim = false;
      // check if STX to claim
      const stackingReward = await getStackingReward(
        version,
        config.citycoin.toLowerCase(),
        userIds[version],
        i
      ).catch(() => 0);
      // check if CityCoins to claim
      const stacker = await getStackerAtCycle(
        version,
        config.citycoin.toLowerCase(),
        userIds[version],
        i
      );
      if (stackingReward > 0 || stacker.toReturn > 0) canClaim = true;
      console.log(`cycle ${i}, ${version}, ${canClaim}`);
      if (canClaim) {
        console.log(`stackingReward: ${stackingReward}`);
        console.log(`stacker.toReturn: ${stacker.toReturn}`);
        console.log(`SENDING TRANSACTION`);
      }
    }
  }
}

async function main() {
  disclaimerIntro(
    "Claim Stacking Rewards",
    "Builds and submits claim-stacking-reward transactions for the selected reward cycles.",
    true
  );
  const config = await setUserConfig();
  const strategy = await setStrategy(config);
  await claimStackingRewards(config, strategy);
  printDivider();
  exitSuccess("all actions complete, script exiting...");
}

main();
