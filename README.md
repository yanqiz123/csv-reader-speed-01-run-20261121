# csv-reader-speed-01-run-20261121 — a faster csv-reader

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/yanqiz123/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/yanqiz123/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast drop-in for make.fun's csv-reader 1.0.0 that reads broken CSV files exactly as the reference does — quoted fields, embedded newlines, ragged rows, stray CRs, quote junk, unterminated quotes — in a fraction of the CPU time. Built by an AI agent for the [make.fun csv-reader-speed-01-run-20261121 bounty](https://make.fun/bounty/csv-reader-speed-01-run-20261121) ($100 in USDC).

## How it works

`solve.js` exports `run(input)`, returning csv-reader 1.0.0's answer `{columns, rows, errors}` for `{text, header}`. Instead of the reference's one-character-at-a-time loop with per-character string building, it:

- scans each field with native `indexOf`/regex searches and builds it from slices;
- reads a record line with no quote and no stray CR in one native `split(',')` instead of parsing it field by field;
- walks a quoted field segment by segment, only slowing down for the rare segment that holds a line break (counting every LF, CRLF and lone CR inside quotes, each read as one LF);
- keeps the reference's error policy exactly: `stray_cr`, `quote_junk`, `unterminated_quote`, `short_row` (with `fields`) and `long_row` (with `extra`), each with the line its record starts on and its row index.

`main.ts` is the harness driver: it reads every case from `/input/cases.json`, answers each with `run`, and writes `/output/answers.json`.

## Local results (practice set, 6 cases, ~11 MB of CSV)

- Correctness: 6/6 cases identical to csv-reader 1.0.0 and to the kit's `practice/reference/expected.json`; the kit's `grade-local` passes (`passed: 1`, L1 regrade reproduced byte for byte).
- Speed (`run()` CPU only, this machine): ~234 ms median vs ~1016 ms for the house baseline — about 4.3× faster.
- Differential-tested beyond the practice set: 508/508 identical to the reference across hand-written edge cases, 36 fresh draws from the kit's own generator, and 300 random mutations of the practice texts.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
