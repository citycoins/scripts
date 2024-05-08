import {
  CityConfigList,
  CityVersionConfig,
  CityVersionConfigList,
  daoContracts,
  daoDeployer,
} from "./citycoins";

/* COMPILED CONFIGURATION OBJECT */

const nycVersions = (network: string): CityVersionConfigList => {
  return {
    "legacy-v1": nycLegacyV1(network),
    "legacy-v2": nycLegacyV2(network),
    "dao-v1": nycDaoV1(network),
  };
};

// version keys are included in city object
// currentVersion is the default version
export const nycConfigList = (network: string): CityConfigList => {
  return {
    city: {
      name: "nyc",
      displayName: "New York City",
      logo: "https://cdn.citycoins.co/logos/newyorkcitycoin.png",
      versions: Object.keys(nycVersions),
      currentVersion: "dao-v1",
      activationBlock: 37449,
    },
    versions: nycVersions(network),
  };
};

/* SETTINGS PER CODE VERSION */

const nycLegacyV1 = (network: string): CityVersionConfig => {
  return {
    enabled: false,
    startAt: 37449,
    endAt: 58917,
    auth: {
      deployer:
        network === "mainnet"
          ? "SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5"
          : "",
      contractName: "newyorkcitycoin-auth",
    },
    mining: {
      deployer:
        network === "mainnet"
          ? "SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5"
          : "",
      contractName: "newyorkcitycoin-core-v1",
      miningFunction: "mine-many",
      miningClaimFunction: "claim-mining-reward",
    },
    stacking: {
      deployer:
        network === "mainnet"
          ? "SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5"
          : "",
      contractName: "newyorkcitycoin-core-v1",
      stackingFunction: "stack-tokens",
      stackingClaimFunction: "claim-stacking-reward",
    },
    token: {
      deployer:
        network === "mainnet"
          ? "SP2H8PY27SEZ03MWRKS5XABZYQN17ETGQS3527SA5"
          : "",
      contractName: "newyorkcitycoin-token",
      displayName: "NewYorkCityCoin",
      decimals: 0,
      symbol: "NYC",
      tokenName: "newyorkcitycoin",
    },
  };
};

const nycLegacyV2 = (network: string): CityVersionConfig => {
  return {
    enabled: true,
    startAt: 58921,
    endAt: undefined,
    auth: {
      deployer:
        network === "mainnet"
          ? "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11"
          : "STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ",
      contractName: "newyorkcitycoin-auth-v2",
    },
    mining: {
      deployer:
        network === "mainnet"
          ? "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11"
          : "STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ",
      contractName: "newyorkcitycoin-core-v2",
      miningFunction: "mine-many",
      miningClaimFunction: "claim-mining-reward",
    },
    stacking: {
      deployer:
        network === "mainnet"
          ? "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11"
          : "STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ",
      contractName: "newyorkcitycoin-core-v2",
      stackingFunction: "stack-tokens",
      stackingClaimFunction: "claim-stacking-reward",
    },
    token: {
      deployer:
        network === "mainnet"
          ? "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11"
          : "STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ",
      contractName: "newyorkcitycoin-token-v2",
      displayName: "NewYorkCityCoin",
      decimals: 6,
      symbol: "NYC",
      tokenName: "newyorkcitycoin",
    },
  };
};

const nycDaoV1 = (network: string): CityVersionConfig => {
  return {
    enabled: true,
    startAt: undefined,
    endAt: undefined,
    auth: {
      deployer: daoDeployer(network),
      contractName: "ccd001-direct-execute",
    },
    mining: {
      deployer: daoDeployer(network),
      contractName: "ccd006-city-mining",
      miningFunction: "mine",
      miningClaimFunction: "claim-mining-block",
    },
    stacking: {
      deployer: daoDeployer(network),
      contractName: "ccd007-city-stacking",
      stackingFunction: "stack",
      stackingClaimFunction: "claim-stacking-reward",
    },
    token: {
      deployer:
        network === "mainnet"
          ? "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11"
          : "STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ",
      contractName: "newyorkcitycoin-token-v2",
      displayName: "NewYorkCityCoin",
      decimals: 6,
      symbol: "NYC",
      tokenName: "newyorkcitycoin",
    },
    dao: daoContracts(network),
  };
};
