import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "index.ts",
  platform: "neutral",
  outDir: "dist",
  dts: true,
  sourcemap: true,
  format: {
    esm: {},
    iife: {
      globalName: "crossfilter",
      minify: true,
      outputOptions: { entryFileNames: "crossfilter.min.js", exports: "default" },
    },
  },
});
