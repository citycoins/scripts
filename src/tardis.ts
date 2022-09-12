import "cross-fetch/polyfill";
import prompts from "prompts";
import { fetchReadOnlyFunction } from "micro-stacks/api";
import { standardPrincipalCV, uintCV } from "micro-stacks/clarity";
import { STACKS_NETWORK } from "../lib/stacks";
import {
  cancelPrompt,
  disclaimerIntro,
  exitSuccess,
  printDivider,
} from "../lib/utils";

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
        message: "Select a CityCoin to query:",
        choices: [
          { title: "MiamiCoin (MIA)", value: "MIA" },
          { title: "NewYorkCityCoin (NYC)", value: "NYC" },
        ],
      },
      {
        type: "select",
        name: "action",
        message: "Select a CityCoin to query:",
        choices: [
          { title: "Get Historical Balance", value: "get-historical-balance" },
          { title: "Get Historical Supply", value: "get-historical-supply" },
          {
            title: "Get Historical Stacking Stats",
            value: "get-historical-stacking-stats-or-default",
          },
          {
            title: "Get Historical Stacker Stats",
            value: "get-historical-stacker-stats-or-default",
          },
        ],
      },
      {
        type: (prev) => (prev === "get-stacker-stats" ? "text" : null),
        name: "address",
        message: "Address to query:",
        validate: (value: string) =>
          value === "" ? "Stacks address is required" : true,
      },
      {
        type: "number",
        name: "blockHeight",
        message: "Block height to query:",
        validate: (value) =>
          value > 0 ? true : "Value must be greater than 0",
      },
      {
        type: "toggle",
        name: "continuous",
        message: "Run again once complete?",
        initial: true,
        active: "Yes",
        inactive: "No",
      },
    ],
    {
      onCancel: (prompt: any) => cancelPrompt(prompt.name),
    }
  );

  return userConfig;
}

async function queryTardis(config: any): Promise<any> {
  printDivider();
  console.log("QUERYING TARDIS");
  printDivider();

  // destructure config
  const { citycoin, action, address, blockHeight } = config;

  // toggle for using the address
  const useAddress =
    action === "get-historical-balance" ||
    action === "get-historical-stacker-stats-or-default";

  // set arguments for query
  let args = [];
  args.push(uintCV(blockHeight));
  if (useAddress) args.push(standardPrincipalCV(address));

  // set destination for query
  // need to differentiate between v1 and v2 tardis
  // may not work if total supply is blocked by activation
  // https://explorer.stacks.co/txid/SP2NS7CNBBN3S9J6M4JJHT7WNBETRSBZ9KPVRENBJ.citycoin-tardis-v2?chain=mainnet

  const contractAddress = "SP2NS7CNBBN3S9J6M4JJHT7WNBETRSBZ9KPVRENBJ";
  // const contractName = "citycoin-tardis-v3";
  const contractName = "citycoin-tardis-v2";

  // set options for query
  const options = {
    contractAddress: contractAddress,
    contractName: contractName,
    functionName: `${action}-${citycoin.toLowerCase()}`,
    functionArgs: args,
    network: STACKS_NETWORK,
    senderAddress: contractAddress,
  };

  // query tardis
  const result = await fetchReadOnlyFunction(options, true);

  // show results
  console.log(`action: ${action}`);
  console.log(`block: ${blockHeight}`);
  if (useAddress) console.log(`address: ${address}`);
  typeof result === "object"
    ? console.log(JSON.stringify(result))
    : console.log(result);
}

async function main() {
  const config = await setUserConfig();
  await queryTardis(config);
  if (config.continuous) await main();
  printDivider();
  exitSuccess("all actions complete, script exiting...");
}

disclaimerIntro(
  "CityCoins Tardis",
  "Builds and submits read-only function calls for historical CityCoins data.",
  false
);

main();
