import { stringAsciiCV, uintCV } from "micro-stacks/clarity";
import {
  AnchorMode,
  createAssetInfo,
  FungibleConditionCode,
  makeContractFungiblePostCondition,
  makeContractSTXPostCondition,
  PostConditionMode,
} from "micro-stacks/transactions";
import { CityConfig, getCityConfig } from "../../lib/dao/citycoins";
import {
  getCityId,
  getCurrentRewardCycle,
  getStacker,
  getStackingReward,
  getUserId,
  isCyclePaid,
} from "../../lib/dao/extensions";
import {
  DEFAULT_FEE,
  getStacksConfig,
  NETWORK,
  StacksConfig,
} from "../../lib/dao/stacks";
import {
  exitError,
  printDivider,
  printIntro,
  sleep,
} from "../../lib/dao/utils";
import { deriveChildAccount, getNonce, submitTx } from "../../lib/stacks";

const deployer = "ST355N8734E5PVX9538H2QGMFP38RE211D9E2B4X5"; // ST8A9HZ3PKST0S42VM9523Z9NV42SZ026VZRMY61
const contractName = "ccd007-city-stacking";
// const deployer = "ST8A9HZ3PKST0S42VM9523Z9NV42SZ026VZRMY61";
// const contractName = "ccd007-citycoin-stacking";
const functionName = "claim-stacking-reward";
const startCycle = 399;
const endCycle = 399;

async function quickAndDirtyStackingClaim(
  stacks: StacksConfig,
  citycoins: CityConfig
) {
  // get account address and private key
  const { address, key } = await deriveChildAccount(
    stacks.network,
    stacks.mnemonic,
    stacks.accountIndex
  );
  // get nonce
  let nonce = await getNonce(stacks.network, address);
  // get city id and user id
  const userId = await getUserId(stacks, citycoins);
  const cityId = await getCityId(stacks, citycoins);
  if (userId === 0 || cityId === 0) exitError("userId or cityId not found");
  // get current cycle
  const currentCycle = await getCurrentRewardCycle(stacks, citycoins);
  // set stacking params
  const claimLimit = 25;
  let counter = 1;
  // print tx info
  printDivider();
  console.log(`address for key: ${address}`);
  console.log(`nonce: ${nonce}`);
  console.log(`userId: ${userId}`);
  console.log(`cityId: ${cityId}`);
  console.log(`currentCycle: ${currentCycle}`);
  console.log(`startCycle: ${startCycle}`);
  console.log(`endCycle: ${endCycle}`);
  for (let cycle = startCycle; cycle <= endCycle; cycle++) {
    printDivider();
    console.log(`claiming cycle: ${cycle}`);
    // exit loop if claim reached
    if (counter > claimLimit) {
      console.log(`claim limit reached: ${claimLimit}`);
      break;
    }
    // check if cycle is paid
    const cyclePaid = await isCyclePaid(
      stacks,
      citycoins,
      cityId,
      currentCycle
    );
    if (cyclePaid) {
      console.log(`cycle not paid: ${cycle}`);
      continue;
    }
    // get the claim amounts
    const rewards = await getStackingReward(
      stacks,
      citycoins,
      cityId,
      userId,
      cycle
    );
    // get the stacker info
    const stacker = await getStacker(stacks, citycoins, cityId, userId, cycle);
    console.log(`rewards: ${rewards}`);
    console.log(`stacker: ${JSON.stringify(stacker)}`);
    if (rewards === 0 || (stacker.claimable === 0 && stacker.stacked === 0)) {
      console.log(`no rewards to claim: ${cycle}`);
      continue;
    }
    // create the post conditions
    const postConditions = [];
    postConditions.push(
      makeContractSTXPostCondition(
        deployer, // citycoins.config.dao!.ccd007.deployer,
        contractName, // citycoins.config.dao!.ccd007.contractName,
        FungibleConditionCode.Equal,
        rewards
      )
    );
    if (stacker.claimable > 0) {
      postConditions.push(
        makeContractFungiblePostCondition(
          deployer, // citycoins.config.dao!.ccd007.deployer,
          contractName, // citycoins.config.dao!.ccd007.contractName,
          FungibleConditionCode.Equal,
          stacker.claimable,
          createAssetInfo(
            citycoins.config.token.deployer,
            citycoins.config.token.contractName,
            citycoins.config.token.tokenName
          )
        )
      );
    }
    // create the stacking claim tx
    const txOptions = {
      contractAddress: deployer, // citycoins.config.dao!.ccd007.deployer,
      contractName: contractName, // citycoins.config.dao!.ccd007.contractName,
      functionName: functionName,
      functionArgs: [
        stringAsciiCV(citycoins.city.name.toLowerCase()),
        uintCV(cycle),
      ],
      senderKey: key,
      fee: DEFAULT_FEE,
      nonce: nonce,
      postConditionMode: PostConditionMode.Deny,
      postConditions: postConditions,
      network: NETWORK(stacks.network),
      anchorMode: AnchorMode.Any,
    };
    // broadcast the tx
    console.log("pausing 0.5sec before submit...");
    await sleep(500);
    await submitTx(txOptions, stacks.network);
    // increment nonce + counter
    nonce++;
    counter++;
  }
}

async function main() {
  printIntro(
    "Claim CityCoins Stacking Rewards",
    "Builds and submits a stacking claim transaction for CityCoins on the Stacks blockchain.",
    true
  );
  const stacks = await getStacksConfig();
  const citycoins = await getCityConfig(stacks.network);
  // const config = await getScriptConfig(stacks.network);
  await quickAndDirtyStackingClaim(stacks, citycoins);
}

main();
