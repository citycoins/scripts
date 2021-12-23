# CityCoins AutoMiner <!-- omit in toc -->

> THIS IS ALPHA SOFTWARE THAT REQUIRES A STACKS PRIVATE KEY TO SEND A TRANSACTION.
>
> THE CODE IS FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY.
>
> USE AT YOUR OWN RISK. PLEASE REPORT ANY [ISSUES ON GITHUB](https://github.com/citycoins/scripts/issues).

This utility provides a simple, easy-to-use, prompt-driven interface for mining CityCoins, with options to set strategies, custom values, and continuously run.

- [Obtaining the Private Key](#obtaining-the-private-key)
- [Running the AutoMiner](#running-the-autominer)
- [AutoMiner Configuration](#autominer-configuration)
  - [User Config](#user-config)
  - [Mining Strategy](#mining-strategy)

## Obtaining the Private Key

The private key is used to sign transactions, and is required to send a transaction from a given Stacks address.

More details on how to obtain the private key [can be found here](./privatekey.md).

## Running the AutoMiner

The miner will prompt for information on the first transaction, and use the same information for subsequent transactions if more than one is selected or if continuously mining.

```bash
node autominer.js
```

## AutoMiner Configuration

### User Config

| Name              | Prompt                                                      | Desc                                                   |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| citycoin          | Select a CityCoin to mine:                                  | Sets target contract values in userConfig              |
| stxAddress        | Stacks Address to mine with?                                | Stacks address used for mining                         |
| stxPrivateKey     | Private Key for Stacks Address?                             | Hex encoded private key used to submit tx              |
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

---

[![Back to README](https://img.shields.io/static/v1?label=&message=Back%20to%20README&color=3059d9&style=for-the-badge)](../README.md)
