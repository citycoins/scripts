import { uintCV } from "micro-stacks/clarity";
import {
  AnchorMode,
  createAssetInfo,
  FungibleConditionCode,
  makeStandardFungiblePostCondition,
  PostConditionMode,
} from "micro-stacks/transactions";
import prompts from "prompts";
import { getFullCityConfig, selectCityVersion } from "../../lib/citycoins";
import {
  DEFAULT_FEE,
  deriveChildAccount,
  getNonce,
  getStacksBlockHeight,
  NETWORK,
  submitTx,
} from "../../lib/stacks";
import {
  cancelPrompt,
  disclaimerIntro,
  exitError,
  exitSuccess,
  fromMicro,
  getUserConfig,
  printDivider,
} from "../../lib/utils";

async function getScriptConfig() {
  printDivider();
  console.log("SETTING SCRIPT CONFIGURATION");
  printDivider();

  // prompt for script configuration
  const scriptConfig = await prompts(
    [
      {
        type: "number",
        name: "amount",
        message: "How many CityCoins would you like to stack?",
        validate: (value: number) =>
          value < 1 ? "Value must be greater than 0" : true,
      },
      {
        type: "number",
        name: "cycles",
        message: "How many cycles do you want to stack for? (max: 32)",
        validate: (value: number) => {
          if (value < 1) return "Value must be greater than 0";
          if (value > 32) return "Value must be less than 32";
          return true;
        },
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

async function stackTokens(userConfig: any, scriptConfig: any) {
  printDivider();
  console.log("BUILDING STACKING TRANSACTION");
  printDivider();
  // get current block height
  const currentBlockHeight = await getStacksBlockHeight(userConfig.network);

  // TODO: check that stacking is active
  // TODO: check if user has enough tokens to stack

  // get info for transactions
  const { key } = await deriveChildAccount(
    userConfig.network,
    userConfig.mnemonic,
    userConfig.accountIndex
  );
  let nonce = await getNonce(userConfig.network, userConfig.address);
  console.log(`nonce: ${nonce}`);
  // get citycoin configuration
  const cityConfig = await getFullCityConfig(userConfig.citycoin.toLowerCase());
  const version = await selectCityVersion(
    userConfig.citycoin.toLowerCase(),
    currentBlockHeight
  );
  if (version === "")
    exitError(`Error: no version found for ${userConfig.citycoin}`);
  // configure transaction
  const txOptions = {
    contractAddress: cityConfig[version].deployer,
    contractName: cityConfig[version].core.name,
    functionName: "stack-tokens",
    functionArgs: [uintCV(scriptConfig.amount), uintCV(scriptConfig.cycles)],
    senderKey: key,
    fee: scriptConfig.feeAmount,
    nonce: nonce,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      makeStandardFungiblePostCondition(
        userConfig.address,
        FungibleConditionCode.Equal,
        scriptConfig.amount,
        createAssetInfo(
          cityConfig[version].deployer,
          cityConfig[version].token.name,
          cityConfig[version].token.tokenName
        )
      ),
    ],
    network: NETWORK(userConfig.network),
    anchorMode: AnchorMode.Any,
  };
  await submitTx(txOptions, userConfig.network);
}

async function main() {
  disclaimerIntro(
    "Stack CityCoins",
    "Builds and submits a stack-tokens transaction for a given amount of CityCoins.",
    true
  );
  const userConfig = await getUserConfig();
  const scriptConfig = await getScriptConfig();
  await stackTokens(userConfig, scriptConfig);
  printDivider();
  exitSuccess("all actions complete, script exiting...");
}

main();
