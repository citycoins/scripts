import prompts from "prompts";
import { miaConfigList } from "./mia";
import { nycConfigList } from "./nyc";
import { exitError, onCancel, printDivider } from "./utils";

/* CITY TYPE DEFINITIONS */

export interface CityConfigList {
  city: CityInfo;
  versions: CityVersionList;
}

export interface CityConfig {
  city: CityInfo;
  config: CityVersionConfig;
}

export interface CityInfo {
  name: string;
  displayName: string;
  logo: string;
  versions: string[];
  currentVersion: string;
  activationBlock: number;
}

export type CityVersionList = {
  [index: string]: CityVersionConfig;
};

export interface CityVersionConfig {
  enabled: boolean;
  startAt?: number;
  endAt?: number;
  auth: BaseContract;
  mining: MiningContract;
  stacking: StackingContract;
  token: TokenContract;
  dao?: {
    [key: string]: BaseContract;
  };
}

interface BaseContract {
  contractName: string;
  deployer: string;
}

interface MiningContract extends BaseContract {
  miningFunction: string;
  miningClaimFunction: string;
}

interface StackingContract extends BaseContract {
  stackingFunction: string;
  stackingClaimFunction: string;
}

interface TokenContract extends BaseContract {
  displayName: string;
  decimals: number;
  tokenName: string;
  symbol: string;
}

export interface Stacker {
  claimable: number;
  stacked: number;
}

/* PROMPT HELPERS */

export async function getCityConfig(network: string) {
  printDivider();
  console.log("SETTING CITYCOIN CONFIGURATION");
  printDivider();
  const { citycoin } = await prompts(
    [
      {
        type: "select",
        name: "citycoin",
        message: "Select a CityCoin:",
        choices: [
          { title: "MiamiCoin (MIA)", value: "MIA" },
          { title: "NewYorkCityCoin (NYC)", value: "NYC" },
        ],
      },
      {
        type: null,
        name: "settings",
      },
    ],
    { onCancel }
  );

  return getCurrentCitySettings(network, citycoin);
}

/* CITY CONFIGURATION HELPERS */

export const daoDeployer = (network: string): string => {
  return network === "mainnet"
    ? "SP1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KP98H3NCY"
    : "ST355N8734E5PVX9538H2QGMFP38RE211D9E2B4X5";
};

export const daoContracts = (network: string) => {
  const contracts = {
    ccd001: {
      deployer: daoDeployer(network),
      contractName: "ccd001-direct-execute",
    },
    // TODO: 4 different types to start
    ccd002: {
      deployer: daoDeployer(network),
      contractName: "ccd002-treasury",
    },
    ccd003: {
      deployer: daoDeployer(network),
      contractName: "ccd003-user-registry",
    },
    ccd004: {
      deployer: daoDeployer(network),
      contractName: "ccd004-city-registry",
    },
    ccd005: {
      deployer: daoDeployer(network),
      contractName: "ccd005-city-data",
    },
    // TODO: -citycoin-
    ccd006: {
      deployer: daoDeployer(network),
      contractName: "ccd006-city-mining",
    },
    // TODO: -citycoin-
    ccd007: {
      deployer: daoDeployer(network),
      contractName: "ccd007-city-stacking",
    },
    ccd008: {
      deployer: daoDeployer(network),
      contractName: "ccd008-city-activation",
    },
    ccd009: {
      deployer: daoDeployer(network),
      contractName: "ccd009-auth-v2-adapter",
    },
    ccd010: {
      deployer: daoDeployer(network),
      contractName: "ccd010-core-v2-adapter",
    },
    ccd011: {
      deployer: daoDeployer(network),
      contractName: "ccd011-stacking-payouts",
    },
  };
  return contracts;
};

// general getter for full city configurations
export function getCityConfigList(network: string, city: string) {
  // load the config per city
  switch (city.toLowerCase()) {
    case "mia":
      return miaConfigList(network);
    case "nyc":
      return nycConfigList(network);
    default:
      exitError(`City ${city} not found`);
  }
}

// easy way to get the current config for usage in scripts
export function getCurrentCitySettings(
  network: string,
  city: string
): CityConfig {
  let version = "";
  switch (city.toLowerCase()) {
    case "mia":
      version = miaConfigList(network).city.currentVersion;
      return {
        city: miaConfigList(network).city,
        config: miaConfigList(network).versions[version],
      };
    case "nyc":
      version = nycConfigList(network).city.currentVersion;
      return {
        city: nycConfigList(network).city,
        config: nycConfigList(network).versions[version],
      };
    default:
      exitError(`City ${city} not found`);
  }
}

// TODO: define dao protocol / contracts here
// cities have their own mining/stacking info

// TODO: test if reducer is working as expected
// TODO: look at raname between "config" and "settings"

/*
// advanced way to get the correct config based on block height
function getCitySettingsFromBlock(city: string, block: number): CityConfig {
  const configList = getCityConfigList(city);
  // check that the block is greater than the activation block
  if (block < configList.city.activationBlock) {
    exitError(
      `Block ${block} is less than the activation block ${configList.city.activationBlock}.`
    );
  }
  // reduce the config list to the version active at the given block height
  const config = Object.values(configList.versions).reduce(
    (prev: CityConfig, curr: CityConfig) => {
      // if the start block isn't set
      // or if the block is less than the start block
      // return the previous config
      if (!curr.startAt || block < curr.startAt) return prev;
      // if enabled is false and the end block is set
      // and the block is less than the end block
      // return the current config
      if (!curr.enabled && curr.endAt && block < curr.endAt) return curr;
      // if enabled is true and the start block is set
      // and the block is greater than the start block
      // return the current config
      if (curr.enabled && curr.startAt && block > curr.startAt) return curr;
      // otherwise, return the previous config
      return prev;
    }
  );
  // return the config
  return { city: configList.city, config };
}
*/
