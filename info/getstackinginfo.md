# Get Stacking Info <!-- omit in toc -->

This utility provides a simple, easy-to-use, prompt-driven interface for obtaining Stacking info for an address.

- [Running Get Stacking Info](#running-get-stacking-info)
- [Get Stacking Info Configuration](#get-stacking-info-configuration)
- [Sample Output](#sample-output)

## Running Get Stacking Info

The script will prompt for information when first run, then use it to either query the info for one cycle or all cycles depending on what is selected.

When search all cycles is selected, it starts at cycle 1 and continues until either:

- the amount Stacked in a future cycle is 0
- 32 cycles after the current cycle have been calculated

The output is provided in `console.table()` format.

```bash
node getstackinginfo.js
```

## Get Stacking Info Configuration

| Name            | Prompt                                      | Desc                                                      |
| --------------- | ------------------------------------------- | --------------------------------------------------------- |
| citycoin        | Select a CityCoin to look up stacking info: | Sets target contract values and token names in userConfig |
| stxAddress      | Stacks Address to search for?               | Stacks address used for the query                         |
| searchAllCycles | Search all cycles?                          | Confirm searching all cycles                              |
| targetCycle     | Target cycle?                               | If not searching all, which cycle to query?               |

**Note:** `contractAddress`, `contractName`, and `tokenSymbol` are set as userConfig properties based on the `citycoin` selection

## Sample Output

See below the results for `SP1FJ0MY8M18KZF43E85WJN48SDXYS1EC4BCQW02S`:

```none
┌─────────┬──────────┬───────┬───────────────┬──────────┬───────────┐
│ (index) │ CityCoin │ Cycle │ amountStacked │ toReturn │ stxReward │
├─────────┼──────────┼───────┼───────────────┼──────────┼───────────┤
│    0    │  'MIA'   │   1   │       0       │    0     │     0     │
│    1    │  'MIA'   │   2   │       0       │    0     │     0     │
│    2    │  'MIA'   │   3   │       0       │    0     │     0     │
│    3    │  'MIA'   │   4   │       0       │    0     │     0     │
│    4    │  'MIA'   │   5   │       0       │    0     │     0     │
│    5    │  'MIA'   │   6   │       0       │    0     │     0     │
│    6    │  'MIA'   │   7   │       0       │    0     │     0     │
│    7    │  'MIA'   │   8   │   63750000    │    0     │     0     │
│    8    │  'MIA'   │   9   │   63750000    │    0     │     0     │
│    9    │  'MIA'   │  10   │   63750000    │    0     │     0     │
│   10    │  'MIA'   │  11   │   63750000    │    0     │     0     │
│   11    │  'MIA'   │  12   │   63750000    │ 42500000 │     0     │
│   12    │  'MIA'   │  13   │   21250000    │    0     │     0     │
|   ...   |   ...    |  ...  |      ...      |   ...    |    ...    |
└─────────┴──────────┴───────┴───────────────┴──────────┴───────────┘
```

---

[![Back to README](https://img.shields.io/static/v1?label=&message=Back%20to%20README&color=3059d9&style=for-the-badge)](../README.md)
