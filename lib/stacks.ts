import { StacksMainnet } from "micro-stacks/network"
import { debugLog, fetchJson } from "./utils"

// stacks constants
export const MICRO_UNITS = 1000000
export const STACKS_NETWORK = new StacksMainnet({ coreApiUrl: "https://stacks-node-api.stacks.co" })

// get current Stacks block height
export async function getStacksBlockHeight(): Promise<number> {
  const url = `${STACKS_NETWORK.getCoreApiUrl()}/v2/info`
  const currentBlockResult = await fetchJson(url)
  const currentBlock = +currentBlockResult.stacks_tip_height
  debugLog(`currentBlock: ${currentBlock}`)
  return currentBlock
}

// get current nonce for account
// https://stacks-node-api.mainnet.stacks.co/extended/v1/address/{principal}/nonces
export async function getNonce(address: string): Promise<number> {
  const url = `${STACKS_NETWORK.getCoreApiUrl()}/extended/v1/address/${address}/nonces`
  const nonceResult = await fetchJson(url)
  const nonce = +nonceResult.possible_next_nonce
  return nonce
}
