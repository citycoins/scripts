import { ContractCallTransaction } from "@stacks/stacks-blockchain-api-types";
import { readFile } from "fs/promises";

interface MissedPayouts {
  [key: number]: {
    mia: ContractCallTransaction[];
    nyc: ContractCallTransaction[];
  };
}

async function main() {
  // read missed payouts from file
  const missedPayouts = (await readFile(
    "./results/ccip016-missed-payouts.json"
  ).then((content) => JSON.parse(content.toString()))) as MissedPayouts;

  for (let cycle of Object.keys(missedPayouts)) {
    const cycleNumber = Number(cycle);
    console.log(
      cycle,
      "mia",
      missedPayouts[cycleNumber].mia
        .filter(
          (tx) =>
            tx.contract_call.function_args &&
            tx.contract_call.function_args[1].repr === `u${cycleNumber}`
        )
        .map((tx) => tx.sender_address)
    );
    console.log(
      cycle,
      "nyc",
      missedPayouts[cycleNumber].nyc
        .filter(
          (tx) =>
            tx.contract_call.function_args &&
            tx.contract_call.function_args[1].repr === `u${cycleNumber}`
        )
        .map((tx) => tx.sender_address)
    );
  }
}

main();
