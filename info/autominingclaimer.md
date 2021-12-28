# CityCoins AutoMiningClaimer <!-- omit in toc -->

> THIS IS ALPHA SOFTWARE THAT REQUIRES A STACKS PRIVATE KEY TO SEND A TRANSACTION.
>
> THE CODE IS FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY.
>
> USE AT YOUR OWN RISK. PLEASE REPORT ANY [ISSUES ON GITHUB](https://github.com/citycoins/scripts/issues).

This utility provides a simple, easy-to-use, prompt-driven interface for checking if an address won any blocks, and if so, automatically submits the claim transaction.

- [Obtaining the Private Key](#obtaining-the-private-key)
- [Running the AutoMiningClaimer](#running-the-autominingclaimer)

## Obtaining the Private Key

The private key is used to sign transactions, and is required to send a transaction from a given Stacks address.

More details on how to obtain the private key [can be found here](./privatekey.md).

## Running the AutoMiningClaimer

The miner will prompt for information on the first transaction, and use the information to search for won blocks and submit the claim transaction.

**Note:** This script does not check for the number of already pending transactions for an address, and stops after 25 transactions to prevent exceeding the chaining limit in the mempool.

```bash
node autominingclaimer.js
```
