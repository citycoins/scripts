# CityCoins Scripts

> NOTE: This repository is being updated to use TypeScript, micro-stacks and the CityCoins API.
>
> More information will be added/updated over time.

This directory provides TypeScript examples of how to interact with the Stacks blockchain and CityCoins protocol.

All of the scripts use [prompts](https://github.com/terkelg/prompts) to gather the required information, and nothing is stored on disk.

For scripts that use a private key, remember to **keep it safe** and **never share with anyone**. [This page has more information](./privatekey.md) on how to obtain your hex encoded private key for scripts that require it.

## Requirements

- [Node.js / NPM](https://nodejs.org/en/) (or [nvm](https://github.com/nvm-sh/nvm) for Mac/Linux)
- [TypeScript](https://www.npmjs.com/package/typescript)

## Installation

Clone this repository using either `ssh` or `https`:

```bash
git clone git@github.com:citycoins/scripts.git
OR
git clone https://github.com/citycoins/scripts.git
```

Enter the directory for the scripts and install the prerequisites:

```bash
cd scripts
npm install
```

Any scripts can be run using the following command:

```bash
npx ts-node src/scriptname.ts
```
