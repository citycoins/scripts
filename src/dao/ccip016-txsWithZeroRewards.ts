import { hexToCV, StringAsciiCV, TupleCV, UIntCV } from "micro-stacks/clarity";
import { bytesToHex } from "micro-stacks/common";
import { Client } from "pg";

const query = `select encode(t.tx_id, 'hex'), value from contract_logs  t
where t.canonical and t.microblock_canonical
and t.contract_identifier  = 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd007-citycoin-stacking'
and t.topic  = 'print'
order by t.id desc`;

const main = async () => {
  const client = new Client({
    user: "postgres",
    host: "192.168.129.114",
    database: "postgres",
    password: "postgres",
    port: 5432,
  });

  await client.connect();
  const res = await client.query(query);
  const txsWithEmptyRewards = extractData(res.rows);
  await client.end();
  return txsWithEmptyRewards;
};

main();

const extractData = (rows: { value: Uint8Array; encode: string }[]) => {
  for (let r of rows) {
    const printValue = hexToCV(bytesToHex(r.value)) as TupleCV<{
      cityId: UIntCV;
      claimable: UIntCV;
      event: StringAsciiCV;
      reward: UIntCV;
      userId: UIntCV;
    }>;
    if (printValue.data.event.data !== "stacking-claim") {
      continue;
    }
    if (printValue.data.reward.value > 0n) {
      continue;
    }
    console.log(
      r.encode,
      printValue.data.cityId.value,
      printValue.data.userId.value
    );
  }
};
