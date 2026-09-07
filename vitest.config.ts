import { defineConfig } from "vitest/config";

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
        test: {
          name: "react",
          include: ["test/**/*.test.tsx"],
          benchmark: { include: [] },
          environment: "happy-dom",
        },
      },
    ],
  },
});
