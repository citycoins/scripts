import * as bip39 from "bip39";
import BIP32Factory from "bip32";
import ECPairFactory from "ecpair";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { StacksMainnet, StacksTestnet } from "micro-stacks/network";
import {
  addressFromPublicKeys,
  AddressHashMode,
  createStacksPrivateKey,
  getPublicKeyFromStacksPrivateKey,
  pubKeyfromPrivKey,
  publicKeyFromBuffer,
  publicKeyToString,
  TxBroadcastResult,
} from "micro-stacks/transactions";
import {
  debugLog,
  exitError,
  fetchJson,
  fromMicro,
  printDivider,
  printTimeStamp,
  sleep,
} from "./utils";
import { StacksNetworkVersion } from "micro-stacks/crypto";
import { bytesToHex } from "micro-stacks/common";
import { addressToString } from "micro-stacks/clarity";
import { getPublicKey } from "@noble/secp256k1";

// mainnet toggle, otherwise testnet
export const MAINNET = false;

// bitcoin constants
const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);
const BITCOIN_TESTNET = bitcoin.networks.testnet;
const BITCOIN_MAINNET = bitcoin.networks.bitcoin;
export const BITCOIN_NETWORK = MAINNET ? BITCOIN_MAINNET : BITCOIN_TESTNET;

// stacks constants
const STACKS_MAINNET = new StacksMainnet({
  coreApiUrl: "https://stacks-node-api.mainnet.stacks.co",
});
const STACKS_TESTNET = new StacksTestnet({
  coreApiUrl: "https://stacks-node-api.testnet.stacks.co",
});
export const STACKS_NETWORK: StacksMainnet | StacksTestnet = MAINNET
  ? STACKS_MAINNET
  : STACKS_TESTNET;

// get current Stacks block height
export async function getStacksBlockHeight(): Promise<number> {
  const url = `${STACKS_NETWORK.getCoreApiUrl()}/v2/info`;
  const currentBlockResult = await fetchJson(url);
  const currentBlock = +currentBlockResult.stacks_tip_height;
  debugLog(`currentBlock: ${currentBlock}`);
  return currentBlock;
}

// get current nonce for account
// https://stacks-node-api.mainnet.stacks.co/extended/v1/address/{principal}/nonces
export async function getNonce(address: string): Promise<number> {
  const url = `${STACKS_NETWORK.getCoreApiUrl()}/extended/v1/address/${address}/nonces`;
  const nonceResult = await fetchJson(url);
  const nonce = +nonceResult.possible_next_nonce;
  return nonce;
}

// get the total number of transactions in the Stacks mempool
export async function getTotalMempoolTx(): Promise<number> {
  const url = `${STACKS_NETWORK.getCoreApiUrl()}/extended/v1/tx/mempool`;
  const mempoolResult = await fetchJson(url);
  const totalTx = +mempoolResult.total;
  return totalTx;
}

// get account balances for a given address
export async function getStacksBalances(address: string): Promise<any> {
  const url = `${STACKS_NETWORK.getCoreApiUrl()}/extended/v1/address/${address}/balances`;
  const balanceResult = await fetchJson(url);
  return balanceResult;
}

// get optimal fee for transactions
// based on average of current fees in mempool
export async function getOptimalFee(multiplier: number, checkAllTx = false) {
  let counter = 0;
  let total = 0;
  let limit = 200;
  let url = "";
  let txResults: any = [];

  // query the stacks-node for multiple transactions
  do {
    url = `${STACKS_NETWORK.getCoreApiUrl()}/extended/v1/tx/mempool?limit=${limit}&offset=${counter}&unanchored=true`;
    const result = await fetchJson(url);
    // get total number of tx
    total = checkAllTx ? result.total : result.results.length;
    // add all transactions to main array
    result.results.map((tx: any) => {
      txResults.push(tx);
      counter++;
    });
    // output counter
    checkAllTx && console.log(`Processed ${counter} of ${total}`);
  } while (counter < total);

  const fees = txResults.map((fee: any) => +fee.fee_rate);

  const max = fees.reduce((a: number, b: number) => {
    return a > b ? a : b;
  });
  console.log(`maxFee: ${fromMicro(max)} STX`);

  const sum = fees.reduce((a: number, b: number) => a + b, 0);
  const avg = sum / txResults.length;
  console.log(`avgFee: ${fromMicro(avg)} STX`);

  const mid = Math.floor(fees.length / 2);
  const sorted = fees.sort((a: number, b: number) => a - b);
  const median: number =
    fees.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  console.log(`median: ${fromMicro(median)} STX`);

  const optimalFee = (avg + median) / 2;
  console.log(`multiplier: ${multiplier}`);
  console.log(`optimalFee: ${fromMicro(optimalFee)} STX`);

  return optimalFee * multiplier;
}

// monitor a transaction in pending status
// until confirmed or rejected
export async function monitorTx(
  broadcastedResult: TxBroadcastResult,
  txId: string
) {
  let count = 0;
  const countLimit = 50;
  const url = `${STACKS_NETWORK.coreApiUrl}/extended/v1/tx/${txId}`;

  do {
    const txResult = await fetchJson(url);

    printDivider();
    console.log(
      `TX STATUS: ${
        txResult.hasOwnProperty("tx_status")
          ? txResult.tx_status.toUpperCase()
          : "PENDING"
      }`
    );
    printDivider();
    printTimeStamp();
    console.log(`https://explorer.stacks.co/txid/${txResult.tx_id}`);
    console.log(`attempt ${count + 1} of ${countLimit}`);

    if ("error" in broadcastedResult) {
      console.log(`error: ${broadcastedResult.reason}`);
      console.log(`details:\n${JSON.stringify(broadcastedResult.reason_data)}`);
      return 0;
    } else {
      if (txResult.tx_status === "success") {
        return txResult.block_height;
      }
      if (txResult.tx_status === "abort_by_post_condition") {
        exitError(
          `tx failed, exiting...\ntxid: ${txResult.tx_id}\nhttps://explorer.stacks.co/txid/${txResult.tx_id}`
        );
      }
    }
    // pause for 30min before checking again
    await sleep(300000);
    count++;
  } while (count < countLimit);

  console.log(`reached retry limit, manually check tx`);
  exitError(
    "Unable to find target block height for next transaction, exiting..."
  );
}

export async function deriveChildAccount(mnemonic: string, index: number) {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  if (!seed) exitError("Unable to derive seed from mnemonic");
  const master = bip32.fromSeed(seed);
  const child = master.derivePath(`m/44'/5757'/0'/0/${index}`);
  const ecPair = ECPair.fromPrivateKey(child.privateKey!);
  const childPrivateKeyHex = bytesToHex(ecPair.privateKey!);
  const stxPrivateKey = createStacksPrivateKey(childPrivateKeyHex);
  const stxPublicKey = getPublicKeyFromStacksPrivateKey(stxPrivateKey);
  const directPublicKey = pubKeyfromPrivKey(child.privateKey!);
  const directPublicKey2 = pubKeyfromPrivKey(childPrivateKeyHex);
  const noblePublicKeyUncompressed = getPublicKey(child.privateKey!, false);
  const noblePublicKeyCompressed = getPublicKey(child.privateKey!, true); // isCompressed = true yields same public key as ecPair

  // check private keys
  console.log(`child.privateKey: ${bytesToHex(child.privateKey!)}`);
  console.log(`ecPairPrivateKey: ${bytesToHex(ecPair.privateKey!)}`);
  console.log(`childPrivateKeyHex: ${childPrivateKeyHex}`);
  console.log(
    `stxPrivateKey: ${bytesToHex(stxPrivateKey.data)} ${
      stxPrivateKey.compressed && " (compressed)"
    }`
  );
  console.log(
    `stxSlicedPrivateKey: ${bytesToHex(stxPrivateKey.data.slice(0, 32))}`
  );

  // check public keys
  console.log(`ecPairPublicKey: ${bytesToHex(ecPair.publicKey!)}`);
  console.log(`stxPublicKey: ${bytesToHex(stxPublicKey.data)}`);
  console.log(`directPublicKey: ${bytesToHex(directPublicKey.data)}`);
  console.log(`directPublicKey2: ${bytesToHex(directPublicKey2.data)}`);
  console.log(
    `noblePublicKeyUncompressed: ${bytesToHex(noblePublicKeyUncompressed)}`
  );
  console.log(
    `noblePublicKeyCompressed: ${bytesToHex(noblePublicKeyCompressed)}`
  );

  const ecPairStxAddress = addressFromPubKey(ecPair.publicKey);
  const stxPublicKeyAddress = addressFromPubKey(stxPublicKey.data);
  const directPublicKeyAddress = addressFromPubKey(directPublicKey.data);
  const directPublicKey2Address = addressFromPubKey(directPublicKey2.data);
  const noblePublicKeyUncompressedAddress = addressFromPubKey(
    noblePublicKeyUncompressed
  );
  const noblePublicKeyCompressedAddress = addressFromPubKey(
    noblePublicKeyCompressed
  );

  // check addresses
  console.log(`ecPairStxAddress: ${addressToString(ecPairStxAddress)}`);
  console.log(`stxPublicKeyAddress: ${addressToString(stxPublicKeyAddress)}`);
  console.log(
    `directPublicKeyAddress: ${addressToString(directPublicKeyAddress)}`
  );
  console.log(
    `directPublicKey2Address: ${addressToString(directPublicKey2Address)}`
  );
  console.log(
    `noblePublicKeyUncompressedAddress: ${addressToString(
      noblePublicKeyUncompressedAddress
    )}`
  );
  console.log(
    `noblePublicKeyCompressedAddress: ${addressToString(
      noblePublicKeyCompressedAddress
    )}`
  );

  const { address: btcAddress } = bitcoin.payments.p2pkh({
    pubkey: ecPair.publicKey,
    network: bitcoin.networks.testnet,
  });

  printDivider();
  const stxAddress = noblePublicKeyCompressedAddress;
  console.log(`stxAddress: ${addressToString(stxAddress)}`);
  console.log(`privateKey: ${childPrivateKeyHex}`);
  console.log(`btcAddress: ${btcAddress}`);

  return { address: addressToString(stxAddress), key: childPrivateKeyHex };
}

function addressFromPubKey(publicKey: Buffer | Uint8Array) {
  return addressFromPublicKeys(
    MAINNET
      ? StacksNetworkVersion.mainnetP2PKH
      : StacksNetworkVersion.testnetP2PKH,
    AddressHashMode.SerializeP2PKH,
    1,
    [publicKeyFromBuffer(publicKey)]
  );
}
