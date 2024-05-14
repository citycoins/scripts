import {
  ContractCallTransaction,
  PostConditionFungible,
} from "@stacks/stacks-blockchain-api-types";
import { readFile } from "fs/promises";
import { MissedPayouts, PayoutData } from "./ccip016-calculation";

async function main() {
  // read missed payouts from file
  const missedPayouts = (await readFile(
    "./results/ccip016-missed-payouts.json"
  ).then((content) => JSON.parse(content.toString()))) as MissedPayouts;
  const payoutData = (await readFile("./results/ccip016-payout-data.json").then(
    (content) => JSON.parse(content.toString())
  )) as PayoutData;

  for (let cycle of Object.keys(missedPayouts)) {
    const cycleNumber = Number(cycle);

    const toUser = (tx: ContractCallTransaction) => {
      const user: { user?: string; cc?: number; stx?: number } = {};
      const ccAmount = (tx.post_conditions[0] as PostConditionFungible).amount;
      user.user = tx.sender_address;
      user.cc = Number(ccAmount);
      const payoutStxAmount = payoutData[cycleNumber].miaPayoutAmount!;
      user.stx = payoutStxAmount;
      return user;
    };

    const affectedAddressesMia = missedPayouts[cycleNumber].mia.map(toUser);
    const affectedAddressesNyc = missedPayouts[cycleNumber].nyc.map(toUser);

    console.log(cycle, "mia", affectedAddressesMia);
    console.log(cycle, "nyc", affectedAddressesNyc);
  }
}

main();
