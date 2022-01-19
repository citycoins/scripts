# Get TX Status <!-- omit in toc -->

This utility provides a simple, easy-to-use, prompt-driven interface for polling a transaction by it's ID until it succeeds or fails.

- [Running Get TX Status](#running-get-tx-status)
- [Get TX Status Configuration](#get-tx-status-configuration)
- [Sample Output](#sample-output)

## Running Get TX Status

The script will prompt for the TXID of the transaction (available on the [Stacks Explorer](https://explorer.stacks.co)) and an interval in minutes to poll for.

```bash
node gettxstatus.js
```

## Get TX Status Configuration

| Name     | Prompt                       | Desc                                       |
| -------- | ---------------------------- | ------------------------------------------ |
| TXID     | TXID to check?               | Sets TXID to query                         |
| interval | Interval (minutes) to check? | Sets the interval to pause between queries |

## Sample Output

Pending TX: this output will loop until the transaction succeeds, fails, or the count limit of 100 attempts is reached.

```none
-------------------------
TX STATUS: PENDING
-------------------------
1/19/2022 12:00:00 PM
account: SP123...45678
nonce: 244
fee: 1.350000 STX
submitted: 1/19/2022 11:59:00 PM
timePassed: 0.01 hours
https://explorer.stacks.co/txid/0x12345678...

```

Successful TX:

```none
-------------------------
TX STATUS: SUCCESS
-------------------------
1/19/2022 12:00:00 PM
tx succeeded, exiting...
txid: 0x12345678...
https://explorer.stacks.co/txid/0x12345678...

```

Failed TX:

```none
-------------------------
TX STATUS: ABORT_BY_POST_CONDITION
-------------------------
1/19/2022 12:00:00 PM
tx failed, exiting...
txid: 0x12345678...
https://explorer.stacks.co/txid/0x12345678...

```

---

[![Back to README](https://img.shields.io/static/v1?label=&message=Back%20to%20README&color=3059d9&style=for-the-badge)](../README.md)
