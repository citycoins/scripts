import {
  bufferCVFromString,
  noneCV,
  principalCV,
  someCV,
  uintCV,
} from "micro-stacks/clarity";
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
        type: "text",
        name: "recipient",
        message: "Stacks Address to send to?",
        validate: (value: string) =>
          value === "" ? "Stacks address is required" : true,
      },
      {
        type: "number",
        name: "amount",
        message: "Amount of CityCoins to transfer? (in micro-units)",
        validate: (value: number) =>
          value > 0 ? true : "Value must be greater than 0",
      },
      {
        type: "text",
        name: "memo",
        message: "Memo? (up to 32 characters)",
        validate: (value: string) =>
          value.length < 32 ? true : "Value must be 32 characters or less.",
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

  if (!scriptConfig.customFee) scriptConfig.feeAmount = DEFAULT_FEE;

  return scriptConfig;
}

async function confirmTransferDetails(userConfig: any, scriptConfig: any) {
  printDivider();
  console.log("CONFIRM TRANSFER DETAILS");
  printDivider();
  console.log(`From:   ${userConfig.address}`);
  console.log(`To:     ${scriptConfig.recipient}`);
  console.log(
    `Amount: ${fromMicro(scriptConfig.amount).toLocaleString()} ${
      userConfig.citycoin
    }`
  );
  console.log(`Fee:    ${fromMicro(scriptConfig.feeAmount)} STX`);
  console.log(`Memo:   ${scriptConfig.memo ? scriptConfig.memo : "(none)"}`);
  printDivider();
  const { confirmTransfer } = await prompts(
    [
      {
        type: "toggle",
        name: "confirmTransfer",
        message: `Confirm transfer details above?`,
        initial: false,
        active: "Yes",
        inactive: "No",
      },
    ],
    {
      onCancel: (prompt: any) => cancelPrompt(prompt.name),
    }
  );
  return confirmTransfer;
}

async function transferTokens(userConfig: any, scriptConfig: any) {
  printDivider();
  console.log("BUILDING TRANSFER TRANSACTION");
  printDivider();
  // get current block height
  const currentBlockHeight = await getStacksBlockHeight(userConfig.network);
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
    contractName: cityConfig[version].token.name,
    functionName: "transfer",
    functionArgs: [
      uintCV(scriptConfig.amount),
      principalCV(userConfig.address),
      principalCV(scriptConfig.recipient),
      scriptConfig.memo
        ? someCV(bufferCVFromString(scriptConfig.memo))
        : noneCV(),
    ],
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
    "Token Transfer",
    "Builds and submits a CityCoin token transfer on Stacks",
    true
  );
  const userConfig = await getUserConfig();
  const scriptConfig = await getScriptConfig();
  const confirmTransfer = await confirmTransferDetails(
    userConfig,
    scriptConfig
  );
  if (!confirmTransfer) exitError("Transfer not confirmed, exiting...");
  await transferTokens(userConfig, scriptConfig);
  printDivider();
  exitSuccess("all actions complete, script exiting...");
}

main();
