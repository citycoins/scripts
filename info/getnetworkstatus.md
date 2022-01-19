# Get Network Status <!-- omit in toc -->

This utility provides a simple, easy-to-use, prompt-driven interface for checking some quick statistics about the Stacks network.

- [Running Get Network Status](#running-get-network-status)
- [Get Network Status Configuration](#get-network-status-configuration)
- [Sample Output](#sample-output)

## Running Get Network Status

The script will prompt if it should analyze all transactions in the mempool or only the first 200, then returns the:

- current block height
- current tx count in mempool
- max and avg fees across mempool

```bash
node getnetworkstatus.js
```

## Get Network Status Configuration

| Name       | Prompt                             | Desc                                 |
| ---------- | ---------------------------------- | ------------------------------------ |
| checkAllTx | Check all TX? (default: first 200) | Sets flag to check all TX in mempool |

## Sample Output

```none
currentBlock: 45721
mempoolTxCount: 13861
maxFee: 20.000000 STX
avgFee: 1.212299 STX
```

---

[![Back to README](https://img.shields.io/static/v1?label=&message=Back%20to%20README&color=3059d9&style=for-the-badge)](../README.md)
