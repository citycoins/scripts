# CityCoins AutoMiningClaimer <!-- omit in toc -->

> THIS IS ALPHA SOFTWARE THAT REQUIRES A STACKS PRIVATE KEY TO SEND A TRANSACTION.
>
> THE CODE IS FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY.
>
> USE AT YOUR OWN RISK. PLEASE REPORT ANY [ISSUES ON GITHUB](https://github.com/citycoins/scripts/issues).

This utility provides a simple, easy-to-use, prompt-driven interface for checking if an address won any blocks, and if so, automatically submits the claim transaction.

- [Obtaining the Private Key](#obtaining-the-private-key)
- [Running the AutoMiningClaimer](#running-the-autominingclaimer)
- [AutoMiningClaimer Configuration](#autominingclaimer-configuration)
  - [User Config](#user-config)
  - [How it Works](#how-it-works)

## Obtaining the Private Key

The private key is used to sign transactions, and is required to send a transaction from a given Stacks address.

More details on how to obtain the private key [can be found here](./privatekey.md).

## Running the AutoMiningClaimer

The miner will prompt for information on the first transaction, and use the information to search for won blocks and submit the claim transaction.

**Note:** This script does not check for the number of already pending transactions for an address, and stops after 25 transactions to prevent exceeding the chaining limit in the mempool.

```bash
node autominingclaimer.js
```

## AutoMiningClaimer Configuration

### User Config

| Name           | Prompt                                             | Desc                                      |
| -------------- | -------------------------------------------------- | ----------------------------------------- |
| citycoin       | Select a CityCoin to mine:                         | Sets target contract values in userConfig |
| stxAddress     | Stacks Address to mine with?                       | Stacks address used for mining            |
| stxPrivateKey  | Private Key for Stacks Address?                    | Hex encoded private key used to submit tx |
| customFee      | Set custom fee?                                    | Confirm setting a custom fee              |
| customFeeValue | Custom fee value in uSTX? (1,000,000 uSTX = 1 STX) | Set the custom fee in uSTX                |

**Note:** both `contractAddress` and `contractName` are set as userConfig properties based on the `citycoin` selection

### How it Works

The AutoMiningClaimer will pull the winning blocks from the related CityCoins block explorer (thanks and s/o to @jamil!), then:

- filter by the user's Stacks address
- check each won block against the contract
  _(using `can-claim-mining-reward`)_
- build a list of up to 25 claim transactions
- submit each of the claim transactions

**Note:** The default fee is set to 0.1 STX, but can be changed to a custom value through the prompts or using the `defaultFee` constant.

**Note:** this script queries the API heavily, and sometimes can fail due to a gateway timeout. If this happens, try running the script again or using a different API node.
