import {
  AnchorMode,
  broadcastTransaction,
  createAssetInfo,
  FungibleConditionCode,
  makeContractCall,
  makeContractFungiblePostCondition,
  makeContractSTXPostCondition,
  PostConditionMode,
  uintCV,
} from "@stacks/transactions";
import BN from "bn.js";
import prompts from "prompts";
import {
  cancelPrompt,
  getNonce,
  printDivider,
  printTimeStamp,
  exitWithError,
  USTX,
  getBlockHeight,
  getRewardCycle,
  getUserId,
  getStackerAtCycleOrDefault,
  getStackingReward,
  timer,
  STACKS_NETWORK,
} from "./utils.js";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

const defaultFee = 100000;

async function promptUserConfig() {
  const questions = [
    {
      type: "select",
      name: "citycoin",
      message: "Select a CityCoin to claim stacking rewards:",
      choices: [
        { title: "MiamiCoin (MIA)", value: "MIA" },
        { title: "NewYorkCityCoin (NYC)", value: "NYC" },
      ],
    },
    {
      type: "text",
      name: "stxAddress",
      message: "Stacks Address to claim with?",
      validate: (value) => (value === "" ? "Stacks address is required" : true),
    },
    {
      type: "password",
      name: "stxPrivateKey",
      message: "Private Key for Stacks Address?",
      validate: (value) =>
        value === "" ? "Stacks private key is required" : true,
    },
    {
      type: "confirm",
      name: "customFee",
      message: `Set custom fee? (default ${(defaultFee / USTX).toFixed(
        6
      )} STX)`,
    },
    {
      type: (prev) => (prev ? "number" : null),
      name: "customFeeValue",
      message: "Custom fee value in uSTX? (1,000,000 uSTX = 1 STX)",
      validate: (value) => (value > 0 ? true : "Value must be greater than 0"),
    },
  ];
  const submit = (prompt, answer, answers) => {
    if (prompt.name === "citycoin") {
      switch (answer) {
        case "MIA":
          answers.deployer = "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27";
          answers.core = "miamicoin-core-v1";
          answers.token = "miamicoin-token";
          answers.tokenName = "miamicoin";
          break;
        case "NYC":
          answers.deployer = "SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5";
          answers.core = "newyorkcitycoin-core-v1";
          answers.token = "newyorkcitycoin-token";
          answers.tokenName = "newyorkcitycoin";
          break;
      }
    }
  };
  const userConfig = await prompts(questions, {
    onCancel: cancelPrompt,
    onSubmit: submit,
  });
  return userConfig;
}

async function claimStackingReward() {
  printDivider();
  printTimeStamp();
  // set max cycles to search
  const maxCycles = 32;
  // get user config
  const userConfig = await promptUserConfig().catch((err) =>
    exitWithError(`promptUserConfig err: ${err}`)
  );
  printDivider();
  // get current block height
  const currentBlockHeight = await getBlockHeight().catch((err) =>
    exitWithError(`getBlockHeight err: ${err}`)
  );
  console.log(`currentBlockHeight: ${currentBlockHeight}`);
  // get current account nonce
  let nonce = await getNonce(userConfig.stxAddress).catch((err) =>
    exitWithError(`getNonce err: ${err}`)
  );
  // get current reward cycle
  const currentCycle = await getRewardCycle(
    userConfig.deployer,
    userConfig.core,
    currentBlockHeight
  ).catch((err) => exitWithError(`getRewardCycle err: ${err}`));
  console.log(`currentCycle: ${currentCycle}`);
  // get v1 user ID
  const userId = await getUserId(
    userConfig.deployer,
    userConfig.core,
    userConfig.stxAddress
  ).catch((err) => exitWithError(`getUserId err: ${err}`));
  console.log(`userId: ${userId}`);
  // check all cycles
  console.log(`Checking cycles 1 to ${currentCycle + maxCycles}...`);
  let i = 5;
  do {
    printDivider();
    let postConditions = [];
    console.log(`cycle: ${i + 1}`);
    // get stacker info
    const stacker = await getStackerAtCycleOrDefault(
      userConfig.deployer,
      userConfig.core,
      i + 1,
      userId
    );
    // get stacking reward
    const stackingReward = await getStackingReward(
      userConfig.deployer,
      userConfig.core,
      i + 1,
      userId
    );
    // display info
    console.log(`amountStacked: ${stacker.value.amountStacked.value}`);
    console.log(`toReturn: ${stacker.value.toReturn.value}`);
    console.log(`stackingReward: ${stackingReward}`);
    // if CC to be returned, set post condition
    if (stacker.value.toReturn.value > 0) {
      const cityCoinsCV = uintCV(stacker.value.toReturn.value);
      postConditions.push(
        makeContractFungiblePostCondition(
          userConfig.deployer,
          userConfig.core,
          FungibleConditionCode.Equal,
          cityCoinsCV.value,
          createAssetInfo(
            userConfig.deployer,
            userConfig.token,
            userConfig.tokenName
          )
        )
      );
    }
    // if STX to be returned, set post condition
    if (stackingReward > 0) {
      const stackingRewardCV = uintCV(stackingReward);
      postConditions.push(
        makeContractSTXPostCondition(
          userConfig.deployer,
          userConfig.core,
          FungibleConditionCode.Equal,
          stackingRewardCV.value
        )
      );
    }
    // check if any tx to process
    if (postConditions.length > 0) {
      printDivider();
      // set the fee
      const feeRate = userConfig.hasOwnProperty("customFeeValue")
        ? userConfig.customFeeValue
        : defaultFee;
      console.log(`sending tx, nonce: ${nonce}`);
      // setup transaction
      const txOptions = {
        contractAddress: userConfig.deployer,
        contractName: userConfig.core,
        functionName: "claim-stacking-reward",
        functionArgs: [uintCV(i + 1)],
        senderKey: userConfig.stxPrivateKey,
        fee: new BN(feeRate),
        nonce: new BN(nonce),
        postConditionMode: PostConditionMode.Deny,
        postConditions: postConditions,
        network: STACKS_NETWORK,
        anchorMode: AnchorMode.Any,
      };
      // serialize transaction
      const transaction = await makeContractCall(txOptions).catch((err) =>
        exitWithError(`makeContractCall err: ${err}`)
      );
      console.log(`https://explorer.stacks.co/txid/${transaction.txid()}`);
      // submit/broadcast transaction
      await broadcastTransaction(transaction, STACKS_NETWORK).catch((err) =>
        exitWithError(`broadcastTransaction err: ${err}`)
      );
      nonce++;
    }
    i++;
    await timer(1000);
  } while (i < currentCycle + maxCycles);
}

claimStackingReward();
