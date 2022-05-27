# Obtaining the Private Key

The hex encoded private key for a Stacks address is required by any script that sends a transaction.

The private key can be obtained through [stacks-gen](https://github.com/psq/stacks-gen).

Using `npx` is the simplest method:

:warning: Random key used below for example purposes, do not use this key for anything.

---

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

The value for `private` is needed for the scripts to be able to send the transaction:

e.g. `63933c159a24820a8bd185be36fd38452d151a32c63d1d22dfcf0ae4b1a1aa6b01`

---

:rotating_light: Seriously, do not use this key for anything. This **private key** is the same as your **seed phrase** and should **never be shared with anyone**.

---

[![Back to README](https://img.shields.io/static/v1?label=&message=Back%20to%20README&color=3059d9&style=for-the-badge)](./README.md)