import "cross-fetch/polyfill";
import { fetchReadOnlyFunction } from "micro-stacks/api";
import { stringAsciiCV, uintCV } from "micro-stacks/clarity";
import { STACKS_NETWORK } from "../lib/stacks";
import { fetchJson, fromMicro, printDivider } from "../lib/utils";

const ccApi = "https://api.citycoins.co";
const miaAuth = "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-auth-v2";
const nycAuth =
  "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-auth-v2";

const jobParameters = [
  "amount1",
  "amount2",
  "amount3",
  "amount4",
  "amount5",
  "amountBonus",
  "amountDefault",
];

async function run() {
  printDivider();
  printDivider();
  console.log("CCIP-012: Phase 1: update coinbase amounts");
  printDivider();
  printDivider();
  console.log("This script will perform the following for MIA/NYC:");
  console.log("1. Query and display the current coinbase amounts from the API");
  console.log("2. Query and display the job parameters from the auth contract");
  console.log("3. Query and display job information from the auth contract");

  ////////// MIAMICOIN

  printDivider();
  printDivider();
  console.log("MIAMICOIN");
  printDivider();
  printDivider();
  console.log(`Querying current coinbase amounts from the API...\n`);
  const miaAmounts = await fetchJson(
    `${ccApi}/v2/mia/token/get-coinbase-amounts`
  );
  for (const amount in miaAmounts) {
    console.log(
      `${amount}: ${miaAmounts[amount]} (${fromMicro(miaAmounts[amount])})`
    );
  }

  printDivider();
  console.log(`Querying job parameters from the auth contract...\n`);
  for (const param of jobParameters) {
    const miaParamOptions = {
      contractAddress: miaAuth.split(".")[0],
      contractName: miaAuth.split(".")[1],
      functionName: "get-uint-value-by-name",
      functionArgs: [uintCV(1), stringAsciiCV(param)],
      network: STACKS_NETWORK,
      senderAddress: miaAuth.split(".")[0],
    };
    const miaParam: number = await fetchReadOnlyFunction(miaParamOptions, true);
    console.log(`${param}: ${miaParam} (${fromMicro(miaParam)})`);
  }

  printDivider();
  console.log(`Querying job information from the auth contract...\n`);
  const miaJobOptions = {
    contractAddress: miaAuth.split(".")[0],
    contractName: miaAuth.split(".")[1],
    functionName: "get-job",
    functionArgs: [uintCV(1)],
    network: STACKS_NETWORK,
    senderAddress: miaAuth.split(".")[0],
  };
  const miaJob = await fetchReadOnlyFunction(miaJobOptions, true);
  console.log(miaJob);

  ////////// NEWYORKCITYCOIN

  printDivider();
  printDivider();
  console.log("NEWYORKCITYCOIN");
  printDivider();
  printDivider();
  console.log(`Querying current coinbase amounts from the API...\n`);
  const nycAmounts = await fetchJson(
    `${ccApi}/v2/nyc/token/get-coinbase-amounts`
  );
  for (const amount in nycAmounts) {
    console.log(
      `${amount}: ${nycAmounts[amount]} (${fromMicro(nycAmounts[amount])})`
    );
  }

  printDivider();
  console.log(`Querying job parameters from the auth contract...\n`);
  for (const param of jobParameters) {
    const nycParamOptions = {
      contractAddress: nycAuth.split(".")[0],
      contractName: nycAuth.split(".")[1],
      functionName: "get-uint-value-by-name",
      functionArgs: [uintCV(1), stringAsciiCV(param)],
      network: STACKS_NETWORK,
      senderAddress: nycAuth.split(".")[0],
    };
    const nycParam: number = await fetchReadOnlyFunction(nycParamOptions, true);
    console.log(`${param}: ${nycParam} (${fromMicro(nycParam)})`);
  }

  printDivider();
  console.log(`Querying job information from the auth contract...\n`);
  const nycJobOptions = {
    contractAddress: nycAuth.split(".")[0],
    contractName: nycAuth.split(".")[1],
    functionName: "get-job",
    functionArgs: [uintCV(1)],
    network: STACKS_NETWORK,
    senderAddress: nycAuth.split(".")[0],
  };
  const nycJob = await fetchReadOnlyFunction(nycJobOptions, true);
  console.log(nycJob);
}

run();
