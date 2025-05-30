import { ContractCallTransaction } from "@stacks/stacks-blockchain-api-types";
import { readFile } from "fs/promises";
import { callReadOnlyFunction } from "micro-stacks/api";
import { OptionalCV, TupleCV, UIntCV, uintCV } from "micro-stacks/clarity";
import { StacksMainnet } from "micro-stacks/network";
import { MissedPayouts, PayoutData } from "./ccip016-calculation";

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

    const toUser = ({
      userStackingStats,
      tx,
    }: {
      userStackingStats: number;
      tx: ContractCallTransaction;
    }) => {
      const user: {
        user?: string;
        cc?: number;
        stx?: number;
      } = {};
      user.user = tx.sender_address;
      user.cc = userStackingStats;
      const arg0 = tx.contract_call?.function_args?.[0]?.repr;
      const isMia = arg0 === '"mia"';
      const totalCC = isMia ? miaTotalCC : nycTotalCC;
      const payoutStxAmount = isMia
        ? payoutData[cycleNumber].miaPayoutAmount!
        : payoutData[cycleNumber].nycPayoutAmount!;
      user.stx = Math.floor((payoutStxAmount * user.cc) / totalCC);
      contractCodeMia += isMia
        ? `;; ${cycle}: ${payoutStxAmount} * ${user.cc} / ${totalCC}\n(try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u${user.stx} '${user.user}))\n`
        : "";
      contractCodeNyc += isMia
        ? ""
        : `;; ${cycle}: ${payoutStxAmount} * ${user.cc} / ${totalCC}\n(try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u${user.stx} '${user.user}))\n`;
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
