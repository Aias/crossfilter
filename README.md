# Crossfilter

![Tests](https://github.com/crossfilter/crossfilter/workflows/Tests/badge.svg) [![CDNJS](https://img.shields.io/cdnjs/v/crossfilter2.svg)](https://cdnjs.com/libraries/crossfilter2)

**Crossfilter** is a JavaScript library for exploring large multivariate datasets in the browser. Crossfilter supports extremely fast (<30ms) interaction with coordinated views, even with datasets containing a million or more records.

**NOTE:** We are seeking new maintainers for this repo. See [#171](https://github.com/crossfilter/crossfilter/issues/171) for discussion.

Since most interactions only involve a single dimension, and then only small adjustments are made to the filter values, incremental filtering and reducing is significantly faster than starting from scratch. Crossfilter uses sorted indexes (and a few bit-twiddling hacks) to make this possible, dramatically increasing the perfor­mance of live histograms and top-K lists. Crossfilter is available under the [Apache License](/square/crossfilter/blob/master/LICENSE).

This is a community-maintained fork of the original [square/crossfilter](https://github.com/square/crossfilter) library.

Want to learn more? [See the wiki.](https://github.com/crossfilter/crossfilter/wiki)

## Gallery of Community Examples

* [Configurable Chart Collection (C3) - World Bank Example](http://drarmstr.github.io/chartcollection/examples/#worldbank) - ([Source](http://drarmstr.github.io/chartcollection/examples/#worldbank/source), [HTML](http://drarmstr.github.io/chartcollection/examples/#worldbank/html))
* [Dimensional Charting JavaScript Library (dc.js)](https://dc-js.github.io/dc.js/) - ([Source](https://dc-js.github.io/dc.js/docs/stock.html))

## Installation

This package can be found under the name `crossfilter2` in npm:

     pnpm add crossfilter2
     
## Development

Use Node.js 24 and the pnpm version pinned in `package.json`. Install dependencies with `pnpm install --frozen-lockfile`.

`pnpm test` builds the library, runs the tests, typechecks the library and test suite, checks the demo, and runs lint. `pnpm run build` bundles the library with tsdown into an ES module with TypeScript declarations and a minified browser script. `pnpm run benchmark` measures indexing, filtering, and removal.

## Demo

The airline on-time performance example from the original project lives in `demo/` as a React application. It consumes the `crossfilter2` package through the workspace, builds its charts on the modular d3 packages, and treats the crossfilter as an external store through `useSyncExternalStore`. Run `pnpm run demo` to build the library and start the Vite dev server.
