import node from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import json from "rollup-plugin-json";
import { terser } from "rollup-plugin-terser";
import typescript from "@rollup/plugin-typescript";
import * as meta from "./package.json";

const name = "crossfilter";

const config = {
  input: `index.ts`,
  output: {
    file: `${name}.js`,
    name: name,
    format: "umd",
    indent: true,
    extend: true,
    banner: `// ${meta.homepage} v${
      meta.version
    } Copyright ${new Date().getFullYear()} ${meta.author.name}`,
  },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      compilerOptions: {
        declaration: false,
        noEmit: false,
      },
    }),
    node(),
    json(),
    commonjs(),
  ],
};

export default [
  config,
  {
    ...config,
    output: {
      ...config.output,
      file: `${name}.min.js`,
    },
    plugins: [
      ...config.plugins,
      terser({
        output: {
          preamble: config.output.banner,
        },
      }),
    ],
  },
];
