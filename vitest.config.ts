import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const reactTests = {
  include: ["test/**/*.test.tsx"],
  benchmark: { include: [] },
  environment: "happy-dom",
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "core",
          include: ["test/**/*.test.ts"],
          benchmark: { include: ["test/**/*.bench.ts"] },
        },
      },
      {
        test: { name: "react", ...reactTests },
      },
      {
        plugins: [react({ compiler: true })],
        test: { name: "react-compiled", ...reactTests },
      },
    ],
  },
});
