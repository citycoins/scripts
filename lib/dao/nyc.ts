import {
  CityConfigList,
  CityVersionConfig,
  CityVersionList,
} from "./citycoins";

/* SETTINGS PER CODE VERSION */

const nycLegacyV1 = (network: string): CityVersionConfig => {
  return {
    enabled: false,
    startAt: 24497,
    endAt: 58917,
    auth: {
      deployer: "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27",
      contractName: "newyorkcitycoin-auth",
    },
    mining: {
      deployer: "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27",
      contractName: "newyorkcitycoin-core-v1",
      miningFunction: "mine-many",
      miningClaimFunction: "claim-mining-reward",
    },
    stacking: {
      deployer: "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27",
      contractName: "newyorkcitycoin-core-v1",
      stackingFunction: "stack-tokens",
      stackingClaimFunction: "claim-stacking-reward",
    },
    token: {
      deployer: "SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27",
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
      deployer: "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R",
      contractName: "newyorkcitycoin-auth-v2",
    },
    mining: {
      deployer: "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R",
      contractName: "newyorkcitycoin-core-v2",
      miningFunction: "mine-many",
      miningClaimFunction: "claim-mining-reward",
    },
    stacking: {
      deployer: "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R",
      contractName: "newyorkcitycoin-core-v2",
      stackingFunction: "stack-tokens",
      stackingClaimFunction: "claim-stacking-reward",
    },
    token: {
      deployer: "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R",
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
      // deployer: "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R",
      deployer: "ST355N8734E5PVX9538H2QGMFP38RE211D9E2B4X5",
      contractName: "ccd001-direct-execute",
    },
    mining: {
      // deployer: "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R",
      deployer: "ST355N8734E5PVX9538H2QGMFP38RE211D9E2B4X5",
      contractName: "ccd006-city-mining",
      miningFunction: "mine",
      miningClaimFunction: "claim-mining-reward",
    },
    stacking: {
      // deployer: "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R",
      deployer: "ST355N8734E5PVX9538H2QGMFP38RE211D9E2B4X5",
      contractName: "ccd007-city-stacking",
      stackingFunction: "stack",
      stackingClaimFunction: "claim-stacking-reward",
    },
    token: {
      // deployer: "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R",
      deployer: "ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H",
      contractName: "newyorkcitycoin-token-v2",
      displayName: "NewYorkCityCoin",
      decimals: 6,
      symbol: "NYC",
      tokenName: "newyorkcitycoin",
    },
  };
};

/* COMPILED CONFIGURATION OBJECT */

const nycVersions = (network: string): CityVersionList => {
  return {
    "legacy-v1": nycLegacyV1(network),
    "legacy-v2": nycLegacyV2(network),
    "dao-v1": nycDaoV1(network),
  };
};

export const nycConfigList = (network: string): CityConfigList => {
  return {
    city: {
      name: "nyc",
      displayName: "Miami",
      logo: "https://cdn.citycoins.co/logos/newyorkcitycoin.png",
      versions: Object.keys(nycVersions),
      currentVersion: "dao-v1",
      activationBlock: 24497,
    },
    versions: nycVersions(network),
  };
};
