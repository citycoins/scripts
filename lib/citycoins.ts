import { MAINNET } from "./stacks";
import { fetchJson } from "./utils";

const CC_API_BASE = `https://api.citycoins.co`;
// const CC_API_BASE = `https://citycoins-api.citycoins.workers.dev`;

// types from CityCoins API

export interface CityList {
  [name: string]: CityInfo;
}

export interface CityInfo {
  fullName: string;
  logo: string;
  versions: string[];
  currentVersion: string;
}

export interface CityVersions {
  [version: string]: CityConfig;
}

export interface CityConfig {
  cityName: string;
  deployed: boolean;
  deployer: string;
  auth: AuthContract;
  core: CoreContract;
  token: TokenContract;
}

export interface AuthContract {
  name: string;
  initialized: boolean;
}

export interface CoreContract {
  name: string;
  activated: boolean;
  startBlock?: number;
  shutdown: boolean;
  shutdownBlock?: number;
}

export interface TokenContract {
  name: string;
  activated: true;
  activationBlock?: number;
  displayName: string;
  tokenName: string;
  symbol: string;
  decimals: number;
  logo: string;
  uri: string;
}

export interface UserIds {
  [key: string]: number;
}

export interface StackerAtCycle {
  amountStacked: number;
  toReturn: number;
}

// MIAMICOIN

const miaInfo: CityInfo = {
  fullName: "Miami",
  logo: "https://cdn.citycoins.co/brand/MIA_Miami/Coins/SVG/MiamiCoin_StandAlone_Coin.svg",
  versions: ["v1", "v2"],
  currentVersion: "v2",
};

const miaInfoTestnet: CityInfo = {
  fullName: "Miami",
  logo: "https://cdn.citycoins.co/brand/MIA_Miami/Coins/SVG/MiamiCoin_StandAlone_Coin.svg",
  versions: ["v2"],
  currentVersion: "v2",
};

const miaConfig: CityVersions = {
  v1: {
    cityName: "Miami",
    deployed: true,
    deployer: "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27",
    auth: {
      name: "miamicoin-auth",
      initialized: true,
    },
    core: {
      name: "miamicoin-core-v1",
      activated: false,
      startBlock: 24497,
      shutdown: true,
      shutdownBlock: 58917,
    },
    token: {
      name: "miamicoin-token",
      activated: true,
      activationBlock: 24497,
      displayName: "MiamiCoin",
      tokenName: "miamicoin",
      symbol: "MIA",
      decimals: 0,
      logo: "https://cdn.citycoins.co/logos/miamicoin.png",
      uri: "https://cdn.citycoins.co/metadata/miamicoin.json",
    },
  },
  v2: {
    cityName: "Miami",
    deployed: true,
    deployer: "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R",
    auth: {
      name: "miamicoin-auth-v2",
      initialized: true,
    },
    core: {
      name: "miamicoin-core-v2",
      activated: true,
      startBlock: 58921,
      shutdown: false,
    },
    token: {
      name: "miamicoin-token-v2",
      activated: true,
      activationBlock: 24497,
      displayName: "MiamiCoin",
      tokenName: "miamicoin",
      symbol: "MIA",
      decimals: 6,
      logo: "https://cdn.citycoins.co/logos/miamicoin.png",
      uri: "https://cdn.citycoins.co/metadata/miamicoin.json",
    },
  },
};

const miaConfigTestnet: CityVersions = {
  v2: {
    cityName: "Miami",
    deployed: true,
    deployer: "ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H",
    auth: {
      name: "miamicoin-auth-v2",
      initialized: true,
    },
    core: {
      name: "miamicoin-core-v2",
      activated: false,
      startBlock: 92000, // TODO: general estimate
      shutdown: false,
    },
    token: {
      name: "miamicoin-token-v2",
      activated: true,
      activationBlock: 92000, // TODO: general estimate
      displayName: "MiamiCoin",
      tokenName: "miamicoin",
      symbol: "MIA",
      decimals: 6,
      logo: "https://cdn.citycoins.co/logos/miamicoin.png",
      uri: "https://cdn.citycoins.co/metadata/miamicoin.json",
    },
  },
};

// NEWYORKCITYCOIN

const nycInfo: CityInfo = {
  fullName: "New York City",
  logo: "https://cdn.citycoins.co/brand/NYC_NewYorkCity/Coins/SVG/CC_NYCCoin_StandAloneCoin.svg",
  versions: ["v1", "v2"],
  currentVersion: "v2",
};

const nycInfoTestnet: CityInfo = {
  fullName: "New York City",
  logo: "https://cdn.citycoins.co/brand/NYC_NewYorkCity/Coins/SVG/CC_NYCCoin_StandAloneCoin.svg",
  versions: ["v2"],
  currentVersion: "v2",
};

const nycConfig: CityVersions = {
  v1: {
    cityName: "New York City",
    deployed: true,
    deployer: "SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5",
    auth: {
      name: "newyorkcitycoin-auth",
      initialized: true,
    },
    core: {
      name: "newyorkcitycoin-core-v1",
      activated: false,
      startBlock: 37449,
      shutdown: true,
      shutdownBlock: 58922,
    },
    token: {
      name: "newyorkcitycoin-token",
      activated: true,
      activationBlock: 37449,
      displayName: "NewYorkCityCoin",
      tokenName: "newyorkcitycoin",
      symbol: "NYC",
      decimals: 0,
      logo: "https://cdn.citycoins.co/logos/newyorkcitycoin.png",
      uri: "https://cdn.citycoins.co/metadata/newyorkcitycoin.json",
    },
  },
  v2: {
    cityName: "New York City",
    deployed: true,
    deployer: "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11",
    auth: {
      name: "newyorkcitycoin-auth-v2",
      initialized: true,
    },
    core: {
      name: "newyorkcitycoin-core-v2",
      activated: true,
      startBlock: 58925,
      shutdown: false,
    },
    token: {
      name: "newyorkcitycoin-token-v2",
      activated: true,
      activationBlock: 37449,
      displayName: "NewYorkCityCoin",
      tokenName: "newyorkcitycoin",
      symbol: "NYC",
      decimals: 6,
      logo: "https://cdn.citycoins.co/logos/newyorkcitycoin.png",
      uri: "https://cdn.citycoins.co/metadata/newyorkcitycoin.json",
    },
  },
};

const nycConfigTestnet: CityVersions = {
  v2: {
    cityName: "New York City",
    deployed: true,
    deployer: "STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ",
    auth: {
      name: "newyorkcitycoin-auth-v2",
      initialized: true,
    },
    core: {
      name: "newyorkcitycoin-core-v2",
      activated: true,
      startBlock: 92000, // TODO: general estimate
      shutdown: false,
    },
    token: {
      name: "newyorkcitycoin-token-v2",
      activated: true,
      activationBlock: 92000, // TODO: general estimate
      displayName: "NewYorkCityCoin",
      tokenName: "newyorkcitycoin",
      symbol: "NYC",
      decimals: 6,
      logo: "https://cdn.citycoins.co/logos/newyorkcitycoin.png",
      uri: "https://cdn.citycoins.co/metadata/newyorkcitycoin.json",
    },
  },
};

export const CITY_CONFIG = {
  mia: MAINNET ? miaConfig : miaConfigTestnet,
  nyc: MAINNET ? nycConfig : nycConfigTestnet,
};

export async function getCityInfo(city: string): Promise<CityInfo> {
  switch (city) {
    case "mia":
      return MAINNET ? miaInfo : miaInfoTestnet;
    case "nyc":
      return MAINNET ? nycInfo : nycInfoTestnet;
    default:
      throw new Error(`Invalid city name: ${city}`);
  }
}

export async function getFullCityConfig(city: string): Promise<CityVersions> {
  switch (city.toLowerCase()) {
    case "mia":
      return MAINNET ? miaConfig : miaConfigTestnet;
    case "nyc":
      return MAINNET ? nycConfig : nycConfigTestnet;
    default:
      throw new Error(`Invalid city name: ${city}`);
  }
}

export async function selectCityVersion(city: string, block: number) {
  const cityInfo = await getCityInfo(city);
  const cityConfig = await getFullCityConfig(city);
  return cityInfo.versions.reduce((prev, curr) => {
    const startBlock = cityConfig[curr].core.startBlock;
    const shutdown = cityConfig[curr].core.shutdown;
    const shutdownBlock = shutdown
      ? cityConfig[curr].core.shutdownBlock
      : undefined;
    if (startBlock && block < startBlock) return prev;
    if (shutdown && shutdownBlock && block < shutdownBlock) return curr;
    if (!shutdown) return curr;
    return "";
  }, "");
}

export async function getCCBalance(
  version: string,
  city: string,
  address: string
): Promise<string> {
  const url = `${CC_API_BASE}/${version}/${city}/token/get-balance/${address}`;
  const result = await fetchJson(url);
  return result.value;
}

export async function getActivationStatus(
  version: string,
  city: string
): Promise<any> {
  const url = `${CC_API_BASE}/${version}/${city}/`;
}

export async function getMiningStatsAtBlock(
  version: string,
  city: string,
  block: number,
  orDefault = true
): Promise<any> {
  const url = `${CC_API_BASE}/${version}/${city}/mining/get-mining-stats-at-block/${block}/${orDefault}`;
  const result = await fetchJson(url);
  return result;
}

export async function canClaimMiningReward(
  version: string,
  city: string,
  block: number,
  address: string
): Promise<boolean> {
  const url = `${CC_API_BASE}/${version}/${city}/mining-claims/can-claim-mining-reward/${block}/${address}`;
  const result = await fetchJson(url);
  return result.value;
}

export async function getRewardCycle(
  version: string,
  city: string,
  block: number
): Promise<number> {
  const url = `${CC_API_BASE}/${version}/${city}/stacking/get-reward-cycle/${block}`;
  const result = await fetchJson(url);
  return result.value;
}

export async function getUserId(
  version: string,
  city: string,
  address: string
): Promise<number> {
  const url = `${CC_API_BASE}/${version}/${city}/activation/get-user-id/${address}`;
  const result = await fetchJson(url);
  return result.value;
}

export async function getStackingReward(
  version: string,
  city: string,
  userId: number,
  targetCycle: number
): Promise<number> {
  const url = `${CC_API_BASE}/${version}/${city}/stacking-claims/get-stacking-reward/${userId}/${targetCycle}`;
  const result = await fetchJson(url);
  return result.value;
}

export async function getStackerAtCycle(
  version: string,
  city: string,
  userId: number,
  targetCycle: number,
  orDefault = true
): Promise<StackerAtCycle> {
  const url = `${CC_API_BASE}/${version}/${city}/stacking/get-stacker-at-cycle/${userId}/${targetCycle}/${orDefault}`;
  const result = await fetchJson(url);
  return result;
}
