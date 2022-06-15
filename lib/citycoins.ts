import { fetchJson } from "./utils";

const CC_API_BASE = `https://citycoins-api.citycoins.workers.dev`;

export async function getCCBalance(
  version: string,
  city: string,
  address: string
): Promise<string> {
  const url = `${CC_API_BASE}/${version}/${city}/token/get-balance/${address}`;
  const result = await fetchJson(url);
  return result.value;
}
