import "cross-fetch/polyfill";
import prompts from "prompts";
import {
  cancelPrompt,
  debugLog,
  disclaimerIntro,
  exitError,
  exitSuccess,
  printDivider,
} from "../../lib/utils";
import { DEFAULT_FEE, getNonce, STACKS_NETWORK } from "../../lib/stacks";
import { getCCBalance } from "../../lib/citycoins";
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

export async function promptUser() {
  // set submit action for prompts
  // to add CityCoin contract values
  // TODO: generalize this same way as CityCoins UI
  // using constants returned from CityCoins API
  const submit = (prompt: any, answer: any, answers: any) => {
    if (prompt.name === "citycoin") {
      switch (answer) {
        case "MIA":
          answers.contractAddressV1 =
            "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27";
          answers.tokenContractV1 = "miamicoin-token";
          answers.contractAddressV2 =
            "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R";
          answers.tokenContractV2 = "miamicoin-token-v2";
          answers.tokenName = "miamicoin";
          break;
        case "NYC":
          answers.contractAddressV1 =
            "SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5";
          answers.tokenContractV1 = "newyorkcitycoin-token";
          answers.contractAddressV2 =
            "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11";
          answers.tokenContractV2 = "newyorkcitycoin-token-v2";
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
        message: "Select a CityCoin to convert:",
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
        message: "Stacks Address to convert with?",
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
    ],
    {
      onCancel: (prompt: any) => cancelPrompt(prompt.name),
      onSubmit: submit,
    }
  );
  return userConfig;
}

export async function convertToV2(config: any) {
  debugLog(JSON.stringify(config));
  printDivider();
  console.log("BUILD TRANSACTION");
  printDivider();
  // get v1 balance
  const v1Balance = await getCCBalance("v1", config.citycoin, config.stxSender);
  console.log(`v1Balance: ${v1Balance}`);
  if (+v1Balance === 0) {
    exitError(`No balance to convert, exiting...`);
  }
  // get nonce
  const nonce = await getNonce(config.network, config.stxSender);
  console.log(`nonce: ${nonce}`);
  // create tx options
  const txOptions: SignedContractCallOptions = {
    contractAddress: config.contractAddressV2,
    contractName: config.tokenContractV2,
    functionName: "convert-to-v2",
    functionArgs: [],
    senderKey: config.stxPrivateKey,
    fee: DEFAULT_FEE,
    nonce: nonce,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      makeStandardFungiblePostCondition(
        config.stxSender,
        FungibleConditionCode.Equal,
        v1Balance,
        createAssetInfo(
          config.contractAddressV1,
          config.tokenContractV1,
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
  console.log(`TXID: ${transaction.txid()}`);
  console.log(`LINK: https://explorer.stacks.co/txid/0x${transaction.txid()}`);
  printDivider();
  exitSuccess("Transfer succesfully submitted, exiting...");
}

disclaimerIntro(
  "Convert to V2",
  "Builds and submits a CityCoin conversion transaction on Stacks",
  true
);

promptUser().then((config) => convertToV2(config));
