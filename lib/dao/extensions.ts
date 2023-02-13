import { fetchReadOnlyFunction } from "micro-stacks/api";
import { principalCV, stringAsciiCV, uintCV } from "micro-stacks/clarity";
import { CityConfig, Stacker } from "./citycoins";
import { NETWORK, StacksConfig } from "./stacks";
import { fixBigInt } from "./utils";

/* CCD003 */

export async function getUserId(stacks: StacksConfig, citycoins: CityConfig) {
  const result = await fetchReadOnlyFunction({
    contractAddress: citycoins.config.dao!.ccd003.deployer,
    contractName: citycoins.config.dao!.ccd003.contractName,
    functionName: "get-user-id",
    functionArgs: [principalCV(stacks.address)],
    network: NETWORK(stacks.network),
    senderAddress: stacks.address,
  });
  return Number(result);
}

/* CCD004 */

export async function getCityId(stacks: StacksConfig, citycoins: CityConfig) {
  const result = await fetchReadOnlyFunction({
    contractAddress: citycoins.config.dao!.ccd004.deployer,
    contractName: citycoins.config.dao!.ccd004.contractName,
    functionName: "get-city-id",
    functionArgs: [stringAsciiCV(citycoins.city.name.toLowerCase())],
    network: NETWORK(stacks.network),
    senderAddress: stacks.address,
  });
  return Number(result);
}

/* CCD007 */

export async function getCurrentRewardCycle(
  stacks: StacksConfig,
  citycoins: CityConfig
) {
  const result = await fetchReadOnlyFunction({
    contractAddress: citycoins.config.stacking.deployer,
    contractName: citycoins.config.stacking.contractName,
    functionName: "get-current-reward-cycle",
    functionArgs: [],
    network: NETWORK(stacks.network),
    senderAddress: stacks.address,
  });
  return Number(result);
}

export async function getStackingReward(
  stacks: StacksConfig,
  citycoins: CityConfig,
  cityId: number,
  userId: number,
  cycleId: number
) {
  const result = await fetchReadOnlyFunction(
    {
      contractAddress: citycoins.config.dao!.ccd007.deployer,
      contractName: citycoins.config.dao!.ccd007.contractName,
      functionName: "get-stacking-reward",
      functionArgs: [uintCV(cityId), uintCV(userId), uintCV(cycleId)],
      network: NETWORK(stacks.network),
      senderAddress: stacks.address,
    },
    true
  );
  return result ? Number(result) : 0;
}

export async function getStacker(
  stacks: StacksConfig,
  citycoins: CityConfig,
  cityId: number,
  userId: number,
  cycleId: number
) {
  const result = (await fetchReadOnlyFunction(
    {
      contractAddress: citycoins.config.dao!.ccd007.deployer,
      contractName: citycoins.config.dao!.ccd007.contractName,
      functionName: "get-stacker",
      functionArgs: [uintCV(cityId), uintCV(cycleId), uintCV(userId)],
      network: NETWORK(stacks.network),
      senderAddress: stacks.address,
    },
    true
  )) satisfies Stacker;
  return result;
}

export async function isCyclePaid(
  stacks: StacksConfig,
  citycoins: CityConfig,
  cityId: number,
  cycleId: number
) {
  const result = await fetchReadOnlyFunction({
    contractAddress: citycoins.config.stacking.deployer,
    contractName: citycoins.config.stacking.contractName,
    functionName: "is-cycle-paid",
    functionArgs: [uintCV(cityId), uintCV(cycleId)],
    network: NETWORK(stacks.network),
    senderAddress: stacks.address,
  });
  return Boolean(result);
}
