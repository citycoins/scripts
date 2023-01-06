import { noneCV, stringUtf8CV } from "micro-stacks/clarity";
import { validateStacksAddress } from "micro-stacks/crypto";
import {
  AnchorMode,
  broadcastTransaction,
  makeContractCall,
  PostConditionMode,
} from "micro-stacks/transactions";
import prompts from "prompts";
import { getFullCityConfig, selectCityVersion } from "../lib/citycoins";
import { getNonce, getStacksBlockHeight, STACKS_NETWORK } from "../lib/stacks";
import {
  cancelPrompt,
  disclaimerIntro,
  exitError,
  exitSuccess,
  printAddress,
  printDivider,
  sleep,
} from "../lib/utils";

const DEFAULT_FEE = 1000000; // 1 STX per TX

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
        message: "Select a CityCoin to signal for activation:",
        choices: [
          { title: "MiamiCoin (MIA)", value: "MIA" },
          { title: "NewYorkCityCoin (NYC)", value: "NYC" },
        ],
      },
      {
        type: "text",
        name: "stxSender",
        message: "Stacks Address to register with?",
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
        type: "text",
        name: "memo",
        message: "Memo for registration?",
      },
      /* TODO: custom fee handling
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
      */
    ],
    { onCancel: (prompt: any) => cancelPrompt(prompt.name) }
  );
  return userConfig;
}

async function registerUser(config: any) {
  printDivider();
  console.log("REGISTERING USER");
  printDivider();
  printAddress(config.stxSender);
  console.log(`memo: ${config.memo ? config.memo : "(none)"}`);
  // TODO: check if contract activated (get-activation-status)
  // TODO: check if user already registered
  // get current block height
  const currentBlockHeight = await getStacksBlockHeight();
  console.log(`currentBlockHeight: ${currentBlockHeight}`);
  // get info for transactions
  const cityConfig = await getFullCityConfig(config.citycoin.toLowerCase());
  let nonce = await getNonce(config.stxSender);
  console.log(`nonce: ${nonce}`);
  printDivider();
  const version = await selectCityVersion(
    config.citycoin.toLowerCase(),
    currentBlockHeight
  );
  if (version === "")
    exitError(`Error: no version found for ${config.citycoin}`);
  const txOptions = {
    contractAddress: cityConfig[version].deployer,
    contractName: cityConfig[version].core.name,
    functionName: "register-user",
    functionArgs: config.memo ? [stringUtf8CV(config.memo)] : [noneCV()],
    senderKey: config.stxPrivateKey,
    fee: DEFAULT_FEE,
    nonce: nonce,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [],
    network: STACKS_NETWORK,
    anchorMode: AnchorMode.Any,
  };
  try {
    // create contract call and broadcast
    const transaction = await makeContractCall(txOptions);
    const broadcastResult = await broadcastTransaction(
      transaction,
      STACKS_NETWORK
    );
    // check broadcast result
    await sleep(1000); // patience is a virtue
    if ("error" in broadcastResult) {
      console.log(`error: ${broadcastResult.reason}`);
      console.log(`details:\n${JSON.stringify(broadcastResult.reason_data)}`);
      exitError("Error broadcasting transaction, exiting...");
    }
    console.log(`link: https://explorer.stacks.co/txid/${transaction.txid()}`);
  } catch (err) {
    exitError(String(err));
  }
}

async function main() {
  disclaimerIntro(
    "Register User",
    "Builds and submits a register-user transaction for a given city.",
    true
  );
  const config = await setUserConfig();
  await registerUser(config);
  printDivider();
  exitSuccess("all actions complete, script exiting...");
}

main();
