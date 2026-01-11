import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "../main.js": resolve(__dirname, "main.ts"),
      "../crossfilter.js": resolve(__dirname, "index.ts"),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    target: "es2020",
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
  },
  test: {
    include: ["test/**/*.test.js"],
    globals: false,
    environment: "node",
  },
});
