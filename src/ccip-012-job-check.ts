import "cross-fetch/polyfill";
import { fetchReadOnlyFunction } from "micro-stacks/api";
import { stringAsciiCV, uintCV } from "micro-stacks/clarity";
import { STACKS_NETWORK } from "../lib/stacks";
import { fetchJson, fromMicro, printDivider } from "../lib/utils";

const ccApi = "https://api.citycoins.co";

const miaAuth = "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-auth-v2";
const nycAuth =
  "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-auth-v2";

const amountJobParameters = [
  "amount1",
  "amount2",
  "amount3",
  "amount4",
  "amount5",
  "amountBonus",
  "amountDefault",
];

const amountJobId = (city: string) => {
  const jobId = city === "mia" ? 4 : city === "nyc" ? 3 : undefined;
  if (!jobId) throw new Error("Invalid city");
  return jobId;
};

const thresholdJobParameters = [
  "threshold1",
  "threshold2",
  "threshold3",
  "threshold4",
  "threshold5",
];

const thresholdJobId = (city: string) => {
  const jobId = city === "mia" ? 3 : city === "nyc" ? 4 : undefined;
  if (!jobId) throw new Error("Invalid city");
  return jobId;
};

const getContractInfo = async (city: string) => {
  const contractAddress =
    city === "mia"
      ? miaAuth.split(".")[0]
      : city === "nyc"
      ? nycAuth.split(".")[0]
      : undefined;
  const contractName =
    city === "mia"
      ? miaAuth.split(".")[1]
      : city === "nyc"
      ? nycAuth.split(".")[1]
      : undefined;

  if (!contractAddress || !contractName) throw new Error("Invalid city");

  return { contractAddress, contractName };
};

const printCoinbaseAmounts = async (city: string) => {
  const amounts = await fetchJson(
    `${ccApi}/v2/${city}/token/get-coinbase-amounts`
  );
  for (const amount in amounts) {
    console.log(
      `${amount}: ${amounts[amount]} (${fromMicro(amounts[amount])})`
    );
  }
};

const printCoinbaseThresholds = async (city: string) => {
  const thresholds = await fetchJson(
    `${ccApi}/v2/${city}/token/get-coinbase-thresholds`
  );
  for (const threshold in thresholds) {
    console.log(`${threshold}: ${thresholds[threshold]}`);
  }
};

const printJobParameters = async (
  city: string,
  jobId: number,
  jobParams: string[],
  printMicro = false
) => {
  const { contractAddress, contractName } = await getContractInfo(city);
  if (!contractAddress || !contractName) throw new Error("Invalid city");
  for (const param of jobParams) {
    const options = {
      contractAddress: contractAddress,
      contractName: contractName,
      functionName: "get-uint-value-by-name",
      functionArgs: [uintCV(jobId), stringAsciiCV(param)],
      network: STACKS_NETWORK,
      senderAddress: contractAddress,
    };
    const result: number = await fetchReadOnlyFunction(options, true);
    console.log(
      `${param}: ${result} ${printMicro ? `(${fromMicro(result)})` : ""}`
    );
  }
};

const printJobInfo = async (city: string, id: number) => {
  const { contractAddress, contractName } = await getContractInfo(city);
  if (!contractAddress || !contractName) throw new Error("Invalid city");
  const options = {
    contractAddress: contractAddress,
    contractName: contractName,
    functionName: "get-job",
    functionArgs: [uintCV(id)],
    network: STACKS_NETWORK,
    senderAddress: contractAddress,
  };
  const miaJob = await fetchReadOnlyFunction(options, true);
  console.log(miaJob);
};

async function run() {
  printDivider();
  printDivider();
  console.log("CCIP-012: Phase 1: update coinbase amounts and thresholds");
  printDivider();
  printDivider();
  console.log("This script will query and display the following for MIA/NYC:");
  console.log("1. current coinbase amounts from the API");
  console.log("2. coinbase amounts job parameters from the auth contract");
  console.log("3. coinbase amounts job information from the auth contract");
  console.log("4. current coinbase thresholds from the API");
  console.log("5. coinbase thresholds job parameters from the auth contract");
  console.log("6. coinbase thresholds job information from the auth contract ");

  ////////// MIAMICOIN

  printDivider();
  printDivider();
  console.log("MIAMICOIN");
  printDivider();
  printDivider();

  console.log("MIA COINBASE AMOUNTS");
  printDivider();

  console.log(`Querying current coinbase amounts from the API...\n`);
  await printCoinbaseAmounts("mia");

  printDivider();
  console.log(
    `Querying coinbase amounts job parameters from the auth contract...\n`
  );
  await printJobParameters(
    "mia",
    amountJobId("mia"),
    amountJobParameters,
    true
  );

  printDivider();
  console.log(
    `Querying coinbase amounts job information from the auth contract...\n`
  );
  await printJobInfo("mia", amountJobId("mia"));

  printDivider();
  console.log("MIA COINBASE THRESHOLDS");

  printDivider();
  console.log(`Querying current coinbase thresholds from the API...\n`);
  await printCoinbaseThresholds("mia");

  printDivider();
  console.log(
    `Querying coinbase thresholds job parameters from the auth contract...\n`
  );
  await printJobParameters(
    "mia",
    thresholdJobId("mia"),
    thresholdJobParameters
  );

  printDivider();
  console.log(
    `Querying coinbase thresholds job information from the auth contract...\n`
  );
  await printJobInfo("mia", thresholdJobId("mia"));

  ////////// NEWYORKCITYCOIN

  printDivider();
  printDivider();
  console.log("NEWYORKCITYCOIN");
  printDivider();
  printDivider();

  console.log("NYC COINBASE AMOUNTS");
  printDivider();

  console.log(`Querying current coinbase amounts from the API...\n`);
  await printCoinbaseAmounts("nyc");

  printDivider();
  console.log(
    `Querying coinbase amounts job parameters from the auth contract...\n`
  );
  await printJobParameters(
    "nyc",
    amountJobId("nyc"),
    amountJobParameters,
    true
  );

  printDivider();
  console.log(
    `Querying coinbase amounts job information from the auth contract...\n`
  );
  await printJobInfo("nyc", amountJobId("nyc"));

  printDivider();
  console.log("NYC COINBASE THRESHOLDS");

  printDivider();
  console.log(`Querying current coinbase thresholds from the API...\n`);
  await printCoinbaseThresholds("nyc");

  printDivider();
  console.log(
    `Querying coinbase thresholds job parameters from the auth contract...\n`
  );
  await printJobParameters(
    "nyc",
    thresholdJobId("nyc"),
    thresholdJobParameters
  );

  printDivider();
  console.log(
    `Querying coinbase thresholds job information from the auth contract...\n`
  );
  await printJobInfo("nyc", thresholdJobId("nyc"));
}

run();
