import {
  bufferCVFromString,
  noneCV,
  principalCV,
  uintCV,
} from "micro-stacks/clarity";
import {
  AnchorMode,
  FungibleConditionCode,
  makeStandardSTXPostCondition,
  PostConditionMode,
} from "micro-stacks/transactions";
import {
  DEFAULT_FEE,
  deriveChildAccount,
  getNonce,
  NETWORK,
  submitTx,
} from "../../lib/stacks";
import { exitSuccess, getUserConfig, printDivider } from "../../lib/utils";

const poolAddress = "SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60";
const poxVer = "0x01";
const poxHash = "0x13effebe0ea4bb45e35694f5a15bb5b96e851afb";

async function main() {
  const userConfig = await getUserConfig();
  const nonce = await getNonce(userConfig.network, userConfig.address);
  // get info for transactions
  const { key } = await deriveChildAccount(
    userConfig.network,
    userConfig.mnemonic,
    userConfig.accountIndex
  );
  const amount = 500000000; // 500 STX
  /* deposit to contract
  const txOptions = {
    contractAddress: "SP2HNY1HNF5X25VC7GZ3Y48JC4762AYFHKS061BM0",
    contractName: "stacking-contract",
    functionName: "deposit-stx",
    functionArgs: [
      principalCV("SP3CK642B6119EVC6CT550PW5EZZ1AJW661ZMQTYD"),
      uintCV(amount),
    ],
    senderKey: key,
    network: NETWORK(userConfig.network),
    fee: DEFAULT_FEE,
    nonce: nonce,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      makeStandardSTXPostCondition(
        userConfig.address,
        FungibleConditionCode.Equal,
        amount
      ),
    ],
    anchorMode: AnchorMode.Any,
  };
  */
  console.log(`encode toString: ${bufferCVFromString(poxVer).toString()}`);

  // stacking from contract
  const txOptions = {
    contractAddress: "SP2HNY1HNF5X25VC7GZ3Y48JC4762AYFHKS061BM0",
    contractName: "stacking-contract",
    functionName: "stack-stx",
    functionArgs: [
      uintCV(amount),
      principalCV(poolAddress),
      bufferCVFromString(poxVer),
      bufferCVFromString(poxHash),
      noneCV(),
    ],
    senderKey: key,
    network: NETWORK(userConfig.network),
    fee: DEFAULT_FEE,
    nonce: nonce,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [],
    anchorMode: AnchorMode.Any,
  };
  await submitTx(txOptions, userConfig.network);
  printDivider();
  exitSuccess("all actions complete, script exiting...");
}

main();
