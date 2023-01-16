import "cross-fetch/polyfill";
import prompts from "prompts";
import {
  cancelPrompt,
  debugLog,
  disclaimerIntro,
  exitError,
  exitSuccess,
  printDivider,
  MICRO_UNITS,
} from "../../lib/utils";
import { getNonce, STACKS_NETWORK } from "../../lib/stacks";
import { getCCBalance } from "../../lib/citycoins";
import {
  bufferCVFromString,
  noneCV,
  someCV,
  standardPrincipalCV,
  uintCV,
} from "micro-stacks/clarity";
import {
  PostConditionMode,
  makeStandardFungiblePostCondition,
  FungibleConditionCode,
  createAssetInfo,
  makeContractCall,
  SignedContractCallOptions,
  AnchorMode,
  broadcastTransaction,
} from "micro-stacks/transactions";

// set default fee to save time/prompts
const DEFAULT_FEE = 10000; // 0.01 STX, avg is 0.003 STX

export async function promptUser() {
  // set submit action for prompts
  // to add CityCoin contract values
  // TODO: generalize this same way as CityCoins UI
  // using constants returned from CityCoins API
  const submit = (prompt: any, answer: any, answers: any) => {
    if (prompt.name === "citycoin") {
      switch (answer) {
        case "MIA":
          answers.contractAddress = "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R";
          answers.tokenContract = "miamicoin-token-v2";
          answers.tokenName = "miamicoin";
          break;
        case "NYC":
          answers.contractAddress = "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11";
          answers.tokenContract = "newyorkcitycoin-token-v2";
          answers.tokenName = "newyorkcitycoin";
          break;
      }
    }
  };
  printDivider();
  console.log("SET CONFIGURATION");
  printDivider();
  // prompt for user config
  const userConfig = await prompts(
    [
      {
        type: "select",
        name: "citycoin",
        message: "Select a CityCoin to transfer:",
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
        message: "Stacks Address to transfer from?",
        validate: (value: string) =>
          value === "" ? "Stacks address is required" : true,
      },
      {
        type: "password",
        name: "stxPrivateKey",
        message: "Private Key for sender address?",
        validate: (value: string) =>
          value === "" ? "Stacks private key is required" : true,
      },
      {
        type: "text",
        name: "stxRecipient",
        message: "Stacks Address to send to?",
        validate: (value: string) =>
          value === "" ? "Stacks address is required" : true,
      },
      {
        type: "number",
        name: "transferAmount",
        message: "Amount of CityCoins to transfer? (in micro-units)",
        validate: (value: number) =>
          value > 0 ? true : "Value must be greater than 0",
      },
      {
        type: "text",
        name: "transferMemo",
        message: "Memo? (up to 32 characters)",
        validate: (value: string) =>
          value.length < 32 ? true : "Value must be 32 characters or less.",
      },
    ],
    {
      onCancel: (prompt: any) => cancelPrompt(prompt.name),
      onSubmit: submit,
    }
  );
  return userConfig;
}

export async function tokenTransfer(config: any) {
  debugLog(JSON.stringify(config));

  printDivider();
  console.log("CONFIRM AMOUNT");
  printDivider();
  // confirm transfer amount
  console.log(`From:   ${config.stxSender}`);
  console.log(`To:     ${config.stxRecipient}`);
  console.log(
    `Amount: ${(config.transferAmount / MICRO_UNITS).toLocaleString(undefined, {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
    })} ${config.citycoin}`
  );
  console.log(`Memo:   ${config.transferMemo}`);
  const { confirmAmount } = await prompts(
    [
      {
        type: "confirm",
        name: "confirmAmount",
        message: `Confirm transfer details?`,
        initial: false,
      },
    ],
    {
      onCancel: (prompt: any) => cancelPrompt(prompt.name),
    }
  );
  !confirmAmount && exitError("Transfer not confirmed, transaction canceled.");

  printDivider();
  console.log("BUILD TRANSACTION");
  printDivider();
  // get balance, verify balance > transfer amount
  const balance = await getCCBalance("v2", config.citycoin, config.stxSender);
  debugLog(`balance: ${balance}`);
  if (balance < config.transferAmount) {
    exitError(`Insufficient balance: ${balance} < ${config.transferAmount}`);
  }
  // get nonce
  const nonce = await getNonce(config.network, config.stxSender);
  debugLog(`nonce: ${nonce}`);
  // create clarity values
  const amountCV = uintCV(config.transferAmount);
  const fromCV = standardPrincipalCV(config.stxSender);
  const toCV = standardPrincipalCV(config.stxRecipient);
  // memo is an optional buff 34 which can be:
  // none or some(buff 34)
  const memoCV =
    config.transferMemo.length > 0
      ? someCV(bufferCVFromString(config.transferMemo))
      : noneCV();
  // create tx options
  const txOptions: SignedContractCallOptions = {
    contractAddress: config.contractAddress,
    contractName: config.tokenContract,
    functionName: "transfer",
    functionArgs: [amountCV, fromCV, toCV, memoCV],
    senderKey: config.stxPrivateKey,
    fee: DEFAULT_FEE,
    nonce: nonce,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      makeStandardFungiblePostCondition(
        config.stxSender,
        FungibleConditionCode.Equal,
        amountCV.value,
        createAssetInfo(
          config.contractAddress,
          config.tokenContract,
          config.tokenName
        )
      ),
    ],
    network: STACKS_NETWORK,
    anchorMode: AnchorMode.Any,
  };

  printDivider();
  console.log("SUBMIT TRANSACTION");
  printDivider();
  // make contract call
  const transaction = await makeContractCall(txOptions);
  // print raw serialized transaction
  const serializedTx = Buffer.from(transaction.serialize()).toString("hex");
  debugLog(`serialized transaction hex:\n${serializedTx}`);
  // broadcast transaction
  const broadcast = await broadcastTransaction(transaction, STACKS_NETWORK);
  debugLog(JSON.stringify(broadcast));
  // print txid and link
  printDivider();
  debugLog(`TXID: ${transaction.txid()}`);
  debugLog(`LINK: https://explorer.stacks.co/txid/0x${transaction.txid()}`);
  printDivider();
  exitSuccess("Transfer succesfully submitted, exiting...");
}

disclaimerIntro(
  "Token Transfer",
  "Builds and submits a CityCoin token transfer on Stacks",
  true
);

promptUser().then((config) => tokenTransfer(config));
