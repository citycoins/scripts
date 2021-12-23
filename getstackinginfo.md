# Get Stacking Info

This utility provides a simple, easy-to-use, prompt-driven interface for obtaining Stacking info for an address.

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

---

[![Back to README](https://img.shields.io/static/v1?label=&message=Back%20to%20README&color=3059d9&style=for-the-badge)](README.md)

## Sample Output

See below the results for `SP1FJ0MY8M18KZF43E85WJN48SDXYS1EC4BCQW02S`:

```none
┌─────────┬──────────┬───────┬───────────────┬──────────┐
│ (index) │ CityCoin │ Cycle │ amountStacked │ toReturn │
├─────────┼──────────┼───────┼───────────────┼──────────┤
│    0    │  'NYC'   │   1   │       0       │    0     │
│    1    │  'NYC'   │   2   │   71500000    │    0     │
│    2    │  'NYC'   │   3   │   72250000    │    0     │
│    3    │  'NYC'   │   4   │   72250000    │ 18250000 │
│    4    │  'NYC'   │   5   │   54000000    │ 53250000 │
│    5    │  'NYC'   │   6   │    750000     │  750000  │
│    6    │  'NYC'   │   7   │       0       │    0     │
└─────────┴──────────┴───────┴───────────────┴──────────┘
```
