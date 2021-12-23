# CityCoins Scripts

This directory provides a set of Node.js scripts and utilities to interact with the CityCoins protocol.

All functions are documented using [JSDoc](https://jsdoc.app/about-getting-started.html), and the documentation lives on [GitHub Pages](https://citycoins.github.io/scripts).

To learn more about a specific script, click on the link below.

| Name                                       | Description                                       |
| ------------------------------------------ | ------------------------------------------------- |
| [`autominer.js`](autominer.md)             | Utility for continously mining CityCoins          |
| [`getstackinginfo.js`](getstackinginfo.md) | Get the current Stacking info for a given address |

All of the scripts use [prompts](https://github.com/terkelg/prompts) to gather the required information, and nothing is stored on disk.

For scripts that use a private key, remember to **keep it safe** and **never share with anyone**. [This page has more information](privatekey.md) on how to obtain your hex encoded private key for scripts that require it.

## Requirements

- [Node.js / NPM](https://nodejs.org/en/) (or [nvm](https://github.com/nvm-sh/nvm) for Mac/Linux)

## Installation

Clone this repository using either `ssh` or `https`:

```bash
git clone git@github.com:citycoins/scripts.git
OR
git clone https://github.com/citycoins/scripts.git
```

Enter the directory for the scripts and install the prequisites:

```bash
cd scripts
npm install
```

Any scripts listed in the table above can be run using the following command:

```bash
node scriptname.js
```
