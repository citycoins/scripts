import prompts from "prompts";
import {
  cancelPrompt,
  exitWithError,
  getBlockHeight,
  getMiningStatsAtBlockV2,
  printDivider,
} from "./utils.js";

async function checkFutureMining() {
  const questions = {
    type: "select",
    name: "citycoin",
    message: "Select a CityCoin to mine:",
    choices: [
      { title: "MiamiCoin (MIA)", value: "mia" },
      { title: "NewYorkCityCoin (NYC)", value: "nyc" },
    ],
  };
  const userConfig = await prompts(questions, {
    onCancel: cancelPrompt,
  });
  // get current block height
  const currentBlock = await getBlockHeight().catch((err) =>
    exitWithError(`getBlockHeight err: ${err}`)
  );
  console.log(`currentBlockHeight: ${currentBlock}`);
  // query 205 blocks out from current block and work
  // backwards to find last block with active miners
  // let targetBlock = currentBlock + 150;
  let targetBlock = 58925;
  let minerStats;
  do {
    console.log(`targetBlock: ${targetBlock}`);
    minerStats = await getMiningStatsAtBlockV2(
      userConfig.citycoin,
      targetBlock
    ).catch((err) => exitWithError(`getMiningStatsAtBlock err: ${err}`));
    console.log(`minerStats: ${JSON.stringify(minerStats)}`);
    targetBlock -= 1;
  } while (minerStats.minersCount === 0);
  printDivider();
  console.log(`currentBlock: ${currentBlock}`);
  console.log(`targetBlock: ${targetBlock + 1}`);
  console.log(`futureBlocks: ${targetBlock - currentBlock + 1}`);
}

checkFutureMining();
