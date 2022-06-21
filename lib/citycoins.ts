import { fetchJson } from "./utils";

const CC_API_BASE = `https://api.citycoins.co`;
// const CC_API_BASE = `https://citycoins-api.citycoins.workers.dev`;

export async function getCCBalance(
  version: string,
  city: string,
  address: string
): Promise<string> {
  const url = `${CC_API_BASE}/${version}/${city}/token/get-balance/${address}`;
  const result = await fetchJson(url);
  return result.value;
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
