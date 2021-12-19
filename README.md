# CityCoins Scripts

> THIS IS ALPHA SOFTWARE THAT REQUIRES A STACKS PRIVATE KEY TO SEND A TRANSACTION.
>
> THE CODE IS FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY.
>
> USE AT YOUR OWN RISK. PLEASE REPORT ANY [ISSUES ON GITHUB](https://github.com/citycoins/scripts/issues).

This directory provides a set of Node.js scripts to interact with the CityCoins protocol, starting with the AutoMiner utility.

This utility provides a simple, easy-to-use, prompt-driven interface for mining CityCoins, with options to set strategies, custom values, and continuously run.

## Requirements

- [Node.js / NPM](https://nodejs.org/en/) (or [nvm](https://github.com/nvm-sh/nvm) for Mac/Linux)
- Hex encoded private key for a Stacks address

## Obtaining the Private Key

The hex encoded private key required by the script can be obtained through [stacks-gen](https://github.com/psq/stacks-gen).

Using `npx` is the simplest method:

**Note:** random key used for example purposes, do not use this key for anything

```bash
npx -q stacks-gen sk -p "mouse lava square pink fuel morning adapt ozone primary tent exercise trip title spice stand must spider monster erupt field brain source strike lawn"
```

Output:

```json
{
  "phrase": "mouse lava square pink fuel morning adapt ozone primary tent exercise trip title spice stand must spider monster erupt field brain source strike lawn",
  "private": "63933c159a24820a8bd185be36fd38452d151a32c63d1d22dfcf0ae4b1a1aa6b01",
  "public": "032021077d7cd149eb3eafb5df395461d422015f75b71b1178aaf20a0b5e802cb5",
  "public_uncompressed": "042021077d7cd149eb3eafb5df395461d422015f75b71b1178aaf20a0b5e802cb5643f3720df37ae94d7a2d0f07f5a3e4bba4f7bc980c7925e2cd78fe637f650ff",
  "stacks": "SP38VZTWNAP1BZ2ZS7AVDAQJ8XTZW3330KA5YDDM6",
  "stacking": "{ hashbytes: 0xd1bfeb955582bf8bf93ab6d55e48eebfc18c609a, version: 0x00 }",
  "btc": "1L848wpPsaJrHvVvqn1SmYCC1A88TdkCqW",
  "wif": "KzZGj32eABBPrMeBkd2tg6p71gA3wFfJtJ9bDqjNji8mvBwiifsw"
}
```

The value for `private` is needed for the AutoMiner to be able to send the transaction:

`63933c159a24820a8bd185be36fd38452d151a32c63d1d22dfcf0ae4b1a1aa6b01`

**Note:** seriously, do not use this key for anything. This **private key** is the same as your **seed phrase** and should **never be shared with anyone**.

## Installing the AutoMiner

Clone this repository using either `ssh` or `https`:

```bash
git clone git@github.com:citycoins/scripts.git
OR
git clone https://github.com/citycoins/scripts.git
```

Enter the directory for the AutoMiner and install the prequisites:

```bash
cd scripts
npm install
```

## Running the AutoMiner

The miner will prompt for information on the first transaction, and use the same information for subsequent transactions if more than one is selected or continuously mining.

```bash
node autominer.js
```

## AutoMiner Configuration

### User Config

| Name              | Prompt                                                      | Desc                                                   |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| citycoin          | Select a CityCoin to mine:                                  | Sets target contract values in userConfig              |
| stxAddress        | Stacks Address to mine with?                                | Stacks address used for mining                         |
| stxPrivateKey     | Private Key for Stacks Address?                             | Hex-encoded private key used to submit tx              |
| autoMine          | Continuously mine with full STX balance?                    | Confirm continuous mining                              |
| autoMineConfirm   | Confirm mining with full STX balance?                       | Confirm continuous mining again                        |
| numberOfRuns      | Number of mining TX to send?                                | If not continously mining, set number of mining tx     |
| numberOfBlocks    | Number of blocks to mine per TX? (1-200)                    | How many blocks to mine in a single TX                 |
| startNow          | Start mining now?                                           | Confirm starting the miner at the current block height |
| targetBlockHeight | Target block height? (current: currentBlockHeight)          | Set a future block height to send the first TX         |
| customCommit      | Set custom block commit?                                    | Confirm setting a custom block commit                  |
| customCommitValue | Custom block commit value in uSTX? (1,000,000 uSTX = 1 STX) | Set the custom block commit in uSTX                    |
| customFee         | Set custom fee?                                             | Confirm setting a custom fee                           |
| customFeeValue    | Custom fee value in uSTX? (1,000,000 uSTX = 1 STX)          | Set the custom fee in uSTX                             |

**Note:** both `contractAddress` and `contractName` are set as userConfig properties based on the `citycoin` selection

### Mining Strategy

| Name              | Prompt                                                 | Desc                                                             |
| ----------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| strategyDistance  | Number of blocks to search for strategy?               | Used for determining the average total commit for a CityCoin     |
| targetPercentage  | Target percentage of total block commit?               | Used for determining the mining commit based on strategy average |
| maxCommitPerBlock | Max commit per block in uSTX? (1,000,000 uSTX = 1 STX) | Used as a safety threshold to limit the amount spent per block   |

When calculating a commit, the script will:

- get the current block height
- for `strategyDistance` blocks in the past, calculate the total commit per block
- average the total commit per block in the past
- for `strategyDistance` blocks in the future, calculate the total commit per block
- average the total commit per block in the future
- average both the total commit per block in the past and future
- multiply the result by `targetPercentage` to obtain the block commit

**Note:** If the commit is higher than `maxCommitPerBlock` or the max commit based on available funds in the account, the commit will be reduced to the highest value available to commit across `numberOfBlocks` blocks from the User Config.
