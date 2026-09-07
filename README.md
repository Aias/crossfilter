# Crossfilter

![Tests](https://github.com/Aias/crossfilter/actions/workflows/tests.yml/badge.svg)

**Crossfilter** is a JavaScript library for exploring large multivariate datasets in the browser. It supports extremely fast (<30ms) interaction with coordinated views, even with datasets containing a million or more records.

Since most interactions only involve a single dimension, and then only small adjustments are made to the filter values, incremental filtering and reducing is significantly faster than starting from scratch. Crossfilter uses sorted indexes (and a few bit-twiddling hacks) to make this possible, dramatically increasing the performance of live histograms and top-_K_ lists.

This repository is a TypeScript rewrite of the community-maintained [crossfilter/crossfilter](https://github.com/crossfilter/crossfilter), itself a fork of the original [square/crossfilter](https://github.com/square/crossfilter). The runtime API is unchanged, so the upstream [API reference](https://github.com/crossfilter/crossfilter/wiki/API-Reference) still applies; the types are new.

## Installation

    pnpm add crossfilter2

The package ships as an ES module with TypeScript declarations. Node 22.12 and later can `require()` it as well. A minified browser build at `dist/crossfilter.min.js` exposes a global `crossfilter` for script tags and CDNs.

## Usage

```ts
import crossfilter from "crossfilter2";

interface Payment {
  date: Date;
  amount: number;
  type: string;
}

const records: Payment[] = [
  { date: new Date(2024, 0, 1), amount: 24, type: "cash" },
  { date: new Date(2024, 0, 2), amount: 61, type: "card" },
];

const payments = crossfilter(records);
const amount = payments.dimension((payment) => payment.amount);
const type = payments.dimension((payment) => payment.type);
const amountsByTen = amount.group((value) => Math.floor(value / 10) * 10);
const totalByType = type.group().reduceSum((payment) => payment.amount);

amount.filterRange([10, 50]);
amountsByTen.top(3);
totalByType.all();
payments.groupAll().reduceSum((payment) => payment.amount).value();
```

Record types flow from the records you pass in: dimensions know their value type, groups know their key and value types, and reducers infer the accumulated value from the `initial` callback. Pass an explicit record type only when starting empty, as in `crossfilter<Payment>()`.

Filters, additions, and removals are synchronous. Subscribe with `onChange` to react to them:

```ts
const unsubscribe = payments.onChange((event) => {
  console.log(event, payments.groupAll().value());
});
```

## Demo

The airline on-time performance example from the original project lives in `demo/` as a React application. It consumes the `crossfilter2` package through the workspace, builds its charts on the modular d3 packages, and treats the crossfilter as an external store through `useSyncExternalStore`. Run `pnpm run demo` to build the library and start the Vite dev server.

## Development

Use Node.js 24 and the pnpm version pinned in `package.json`. Install dependencies with `pnpm install --frozen-lockfile`.

`pnpm test` builds the library, runs the tests, typechecks the library and test suite, checks the demo, and runs lint. `pnpm run build` bundles the library with tsdown into an ES module with TypeScript declarations and a minified browser script. `pnpm run benchmark` measures indexing, filtering, and removal.

## License

Crossfilter is available under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for attribution.
