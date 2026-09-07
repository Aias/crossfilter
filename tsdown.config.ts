import { defineConfig } from "tsdown";

const coreEntry = "./index.js";

export default defineConfig([
  {
    entry: { index: "index.ts", react: "react.ts" },
    format: "esm",
    platform: "neutral",
    outDir: "dist",
    dts: true,
    sourcemap: true,
    plugins: [
      {
        name: "crossfilter:core-entry",
        resolveId(id, importer) {
          if (id === coreEntry && importer !== undefined) return { id, external: true };
          return null;
        },
      },
    ],
  },
  {
    entry: { crossfilter: "index.ts" },
    format: "iife",
    platform: "neutral",
    outDir: "dist",
    clean: false,
    dts: false,
    globalName: "crossfilter",
    minify: true,
    sourcemap: true,
    outputOptions: { entryFileNames: "crossfilter.min.js", exports: "default" },
  },
]);
