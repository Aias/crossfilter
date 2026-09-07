import json from "rollup-plugin-json";
import { terser } from "rollup-plugin-terser";

export default {
  input: "lib/index.js",
  plugins: [json()],
  output: [
    { file: "main.js", format: "es" },
    { file: "crossfilter.cjs", format: "cjs", exports: "default" },
    { file: "crossfilter.js", format: "umd", name: "crossfilter", exports: "default" },
    {
      file: "crossfilter.min.js",
      format: "umd",
      name: "crossfilter",
      exports: "default",
      plugins: [terser()],
    },
  ],
};
