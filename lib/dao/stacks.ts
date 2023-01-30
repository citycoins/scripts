import prompts from "prompts";
import { TransactionVersion } from "micro-stacks/common";
import { StacksMainnet, StacksTestnet } from "micro-stacks/network";
import {
  generateNewAccount,
  generateWallet,
  getStxAddress,
} from "@stacks/wallet-sdk";
import { confirmByPrompt, exitError, onCancel, printDivider } from "./utils";
import { fetchCoreApiInfo } from "micro-stacks/api";

export const DEFAULT_FEE = 50000; // 0.05 STX per TX
const STACKS_MAINNET = new StacksMainnet({
  coreApiUrl: "https://stacks-node-api.mainnet.stacks.co",
});
const STACKS_TESTNET = new StacksTestnet({
  coreApiUrl: "https://stacks-node-api.testnet.stacks.co",
});

export const NETWORK = (network: string) => {
  if (network === "mainnet") {
    return STACKS_MAINNET;
  } else if (network === "testnet") {
    return STACKS_TESTNET;
  } else {
    return STACKS_TESTNET;
  }
};

const TX_VERSION = (network: string) => {
  if (network === "mainnet") {
    return TransactionVersion.Mainnet;
  } else if (network === "testnet") {
    return TransactionVersion.Testnet;
  } else {
    return TransactionVersion.Testnet;
  }
};

export async function getStacksBlockHeight(network: string) {
  const coreApiInfo = await fetchCoreApiInfo({
    url: NETWORK(network).coreApiUrl,
  });
  return coreApiInfo;
}

export async function getStacksConfig(keyRequired = true) {
  printDivider();
  console.log("SETTING STACKS CONFIGURATION");
  printDivider();
  const stacksConfig = await prompts(
    [
      {
        type: "select",
        name: "network",
        message: "Select a network:",
        choices: [
          { title: "Stacks Mainnet", value: "mainnet" },
          { title: "Stacks Testnet", value: "testnet" },
        ],
      },
      {
        type: () => (keyRequired ? "password" : null),
        name: "mnemonic",
        message: "Seed phrase for Stacks address?",
        validate: (value: string) =>
          value === ""
            ? "Stacks seed phrase is required to send a transaction"
            : true,
      },
      {
        type: null,
        name: "accountIndex",
      },
      {
        type: null,
        name: "address",
      },
    ],
    { onCancel }
  );
  // get first 4 addresses from mnemonic
  const { addresses } = await getChildAccounts(
    stacksConfig.mnemonic,
    3,
    TX_VERSION(stacksConfig.network)
  );
  // create address choices for prompt
  const addressChoices = addresses.map((address: string, index: number) => {
    return { title: address, value: index };
  });
  // add an option for specifying a custom index
  addressChoices.push({ title: "Other...", value: -1 });
  // prompt user to select an address
  const addressConfig = await prompts(
    [
      {
        type: "select",
        name: "index",
        message: "Select an address listed below:",
        choices: addressChoices,
      },
      {
        type: (prev) => (prev === -1 ? "number" : null),
        name: "index",
        message: "Enter the desired account index:",
        validate: (value: number) =>
          value < 0 ? "Account index must be greater than 0" : true,
      },
    ],
    { onCancel }
  );
  // confirm selected address
  const { address } = await getChildAccount(
    stacksConfig.mnemonic,
    addressConfig.index,
    TX_VERSION(stacksConfig.network)
  );
  const confirmAddress = await confirmByPrompt(`Confirm address: ${address}`);
  if (!confirmAddress) exitError("address not confirmed");
  // set remaining config values
  stacksConfig.accountIndex = addressConfig.index;
  stacksConfig.address = address;
  return stacksConfig;
}

export async function getChildAccounts(
  mnemonic: string,
  index: number,
  transactionVersion: TransactionVersion
) {
  // create a Stacks wallet with the mnemonic
  let wallet = await generateWallet({
    secretKey: mnemonic,
    password: "",
  });
  // add a new account to reach the selected index
  for (let i = 0; i <= index; i++) {
    wallet = generateNewAccount(wallet);
  }
  // return all addresses and keys
  const addresses = wallet.accounts.map((account) => {
    return getStxAddress({
      account: account,
      transactionVersion,
    });
  });
  const keys = wallet.accounts.map((account) => account.stxPrivateKey);
  return { addresses, keys };
}

export async function getChildAccount(
  mnemonic: string,
  index: number,
  transactionVersion: TransactionVersion
) {
  // create a Stacks wallet with the mnemonic
  let wallet = await generateWallet({
    secretKey: mnemonic,
    password: "",
  });
  // add a new account to reach the selected index
  for (let i = 0; i <= index; i++) {
    wallet = generateNewAccount(wallet);
  }
  // return address and key for selected index
  const address = getStxAddress({
    account: wallet.accounts[index],
    transactionVersion,
  });
  const key = wallet.accounts[index].stxPrivateKey;
  return { address, key };
}
