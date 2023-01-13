import prompts from "prompts";
import { noneCV, stringUtf8CV } from "micro-stacks/clarity";
import { validateStacksAddress } from "micro-stacks/crypto";
import {
  AnchorMode,
  broadcastTransaction,
  makeContractCall,
  PostConditionMode,
} from "micro-stacks/transactions";
import { getFullCityConfig, selectCityVersion } from "../../lib/citycoins";
import {
  deriveChildAccount,
  getNonce,
  getStacksBlockHeight,
  STACKS_NETWORK,
  submitTx,
} from "../../lib/stacks";
import {
  cancelPrompt,
  disclaimerIntro,
  exitError,
  exitSuccess,
  fromMicro,
  getUserConfig,
  printAddress,
  printDivider,
  sleep,
} from "../../lib/utils";

const DEFAULT_FEE = 1000000; // 1 STX per TX

async function getScriptConfig() {
  printDivider();
  console.log("SETTING SCRIPT CONFIGURATION");
  printDivider();

  // prompt for script config
  const scriptConfig = await prompts(
    [
      {
        type: "text",
        name: "memo",
        message: "Memo for registration?",
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
    { onCancel: (prompt: any) => cancelPrompt(prompt.name) }
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

async function registerUser(userConfig: any, scriptConfig: any) {
  printDivider();
  console.log("BUILDING REGISTER USER TX");
  printDivider();
  const { address, key } = await deriveChildAccount(
    userConfig.network,
    userConfig.mnemonic,
    userConfig.accountIndex
  );
  printAddress(address);
  console.log(`memo: ${scriptConfig.memo ? scriptConfig.memo : "(none)"}`);
  // TODO: check if contract activated (get-activation-status)
  // TODO: check if user already registered
  // get current block height
  const currentBlockHeight = await getStacksBlockHeight(userConfig.network);
  console.log(`currentBlockHeight: ${currentBlockHeight}`);
  // get info for transactions
  const cityConfig = await getFullCityConfig(userConfig.citycoin.toLowerCase());
  let nonce = await getNonce(userConfig.network, address);
  console.log(`nonce: ${nonce}`);
  printDivider();
  const version = await selectCityVersion(
    userConfig.citycoin.toLowerCase(),
    currentBlockHeight
  );
  if (version === "")
    exitError(`Error: no version found for ${userConfig.citycoin}`);
  const txOptions = {
    contractAddress: cityConfig[version].deployer,
    contractName: cityConfig[version].core.name,
    functionName: "register-user",
    functionArgs: scriptConfig.memo
      ? [stringUtf8CV(scriptConfig.memo)]
      : [noneCV()],
    senderKey: key,
    fee: DEFAULT_FEE,
    nonce: nonce,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [],
    network: STACKS_NETWORK,
    anchorMode: AnchorMode.Any,
  };
  await submitTx(txOptions, userConfig.network);
}

async function main() {
  disclaimerIntro(
    "Register User",
    "Builds and submits a register-user transaction for a given city.",
    true
  );
  const userConfig = getUserConfig();
  const scriptConfig = getScriptConfig();
  await registerUser(userConfig, scriptConfig);
  printDivider();
  exitSuccess("all actions complete, script exiting...");
}

main();
