import {
  ContractCallTransaction,
  PostConditionFungible,
} from "@stacks/stacks-blockchain-api-types";
import { readFile } from "fs/promises";
import { callReadOnlyFunction } from "micro-stacks/api";
import { OptionalCV, TupleCV, UIntCV, uintCV } from "micro-stacks/clarity";
import { StacksMainnet } from "micro-stacks/network";
import { hiroApiBase, MissedPayouts, PayoutData } from "./ccip016-calculation";

const network = new StacksMainnet({ url: hiroApiBase });

async function fetchStackingStats(cycle: number, cityId: number) {
  const result = (await callReadOnlyFunction({
    contractAddress: "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH",
    contractName: "ccd007-citycoin-stacking",
    functionName: "get-stacking-stats",
    functionArgs: [uintCV(cityId), uintCV(cycle)],
    senderAddress: "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH",
    network: network,
  })) as TupleCV<{
    reward: OptionalCV<UIntCV>;
    total: UIntCV;
  }>;
  return Number(result.data.total.value);
}

async function main() {
  // read missed payouts from file
  const missedPayouts = (await readFile(
    "./results/ccip016-missed-payouts.json"
  ).then((content) => JSON.parse(content.toString()))) as MissedPayouts;
  const payoutData = (await readFile("./results/ccip016-payout-data.json").then(
    (content) => JSON.parse(content.toString())
  )) as PayoutData;

  let contractCodeMia = "";
  let contractCodeNyc = "";
  let totalMia = 0;
  let totalNyc = 0;
  for (let cycle of Object.keys(missedPayouts)) {
    const cycleNumber = Number(cycle);

    const miaTotalCC = await fetchStackingStats(cycleNumber, 1);
    const nycTotalCC = await fetchStackingStats(cycleNumber, 2);

    const toUser = (tx: ContractCallTransaction) => {
      const user: {
        user?: string;
        cc?: number;
        stx?: number;
      } = {};
      const ccAmount = (tx.post_conditions[0] as PostConditionFungible).amount;
      user.user = tx.sender_address;
      user.cc = Number(ccAmount);
      const payoutStxAmount = payoutData[cycleNumber].miaPayoutAmount!;
      const arg0 = tx.contract_call?.function_args?.[0]?.repr;
      console.log(arg0);
      const isMia = arg0 === '"mia"';
      const totalCC = isMia ? miaTotalCC : nycTotalCC;
      user.stx = Math.floor((payoutStxAmount * user.cc) / totalCC);
      contractCodeMia += isMia
        ? `(pay-rewards '${user.user} ${user.stx})\n`
        : "";
      contractCodeNyc += isMia
        ? ""
        : `(pay-rewards '${user.user} ${user.stx})\n`;
      totalMia += isMia ? user.stx || 0 : 0;
      totalNyc += isMia ? 0 : user.stx || 0;
      return user;
    };

    const affectedAddressesMia = missedPayouts[cycleNumber].mia.map(toUser);
    const affectedAddressesNyc = missedPayouts[cycleNumber].nyc.map(toUser);

    console.log(cycle, "mia", affectedAddressesMia);
    console.log(cycle, "nyc", affectedAddressesNyc);
  }
  console.log({ totalMia, totalNyc });
  console.log("Contract code for MIA");
  console.log(contractCodeMia);
  console.log("Contract code for NYC");
  console.log(contractCodeNyc);
}

main();
