import {
  CityConfigList,
  CityVersionConfig,
  CityVersionList,
  daoContracts,
  daoDeployer,
} from "./citycoins";

/* COMPILED CONFIGURATION OBJECT */

const miaVersions = (network: string): CityVersionList => {
  return {
    "legacy-v1": miaLegacyV1(network),
    "legacy-v2": miaLegacyV2(network),
    "dao-v1": miaDaoV1(network),
  };
};

// version keys are included in city object
// currentVersion is the default version
export const miaConfigList = (network: string): CityConfigList => {
  return {
    city: {
      name: "mia",
      displayName: "Miami",
      logo: "https://cdn.citycoins.co/logos/miamicoin.png",
      versions: Object.keys(miaVersions),
      currentVersion: "dao-v1",
      activationBlock: 24497,
    },
    versions: miaVersions(network),
  };
};

/* SETTINGS PER CODE VERSION */

const miaLegacyV1 = (network: string): CityVersionConfig => {
  return {
    enabled: false,
    startAt: 24497,
    endAt: 58917,
    auth: {
      deployer:
        network === "mainnet" ? "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27" : "",
      contractName: "miamicoin-auth",
    },
    mining: {
      deployer:
        network === "mainnet" ? "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27" : "",
      contractName: "miamicoin-core-v1",
      miningFunction: "mine-many",
      miningClaimFunction: "claim-mining-reward",
    },
    stacking: {
      deployer:
        network === "mainnet" ? "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27" : "",
      contractName: "miamicoin-core-v1",
      stackingFunction: "stack-tokens",
      stackingClaimFunction: "claim-stacking-reward",
    },
    token: {
      deployer:
        network === "mainnet" ? "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27" : "",
      contractName: "miamicoin-token",
      displayName: "MiamiCoin",
      decimals: 0,
      symbol: "MIA",
      tokenName: "miamicoin",
    },
  };
};

const miaLegacyV2 = (network: string): CityVersionConfig => {
  return {
    enabled: true,
    startAt: 58921,
    endAt: undefined,
    auth: {
      deployer:
        network === "mainnet"
          ? "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R"
          : "ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H",
      contractName: "miamicoin-auth-v2",
    },
    mining: {
      deployer:
        network === "mainnet"
          ? "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R"
          : "ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H",
      contractName: "miamicoin-core-v2",
      miningFunction: "mine-many",
      miningClaimFunction: "claim-mining-reward",
    },
    stacking: {
      deployer:
        network === "mainnet"
          ? "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R"
          : "ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H",
      contractName: "miamicoin-core-v2",
      stackingFunction: "stack-tokens",
      stackingClaimFunction: "claim-stacking-reward",
    },
    token: {
      deployer:
        network === "mainnet"
          ? "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R"
          : "ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H",
      contractName: "miamicoin-token-v2",
      displayName: "MiamiCoin",
      decimals: 6,
      symbol: "MIA",
      tokenName: "miamicoin",
    },
  };
};

const miaDaoV1 = (network: string): CityVersionConfig => {
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
          ? "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R"
          : "ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H",
      contractName: "miamicoin-token-v2",
      tokenName: "miamicoin",
      displayName: "MiamiCoin",
      decimals: 6,
      symbol: "MIA",
    },
    dao: daoContracts(network),
  };
};
