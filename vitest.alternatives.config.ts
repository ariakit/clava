import { defineConfig, mergeConfig } from "vitest/config";
import { createPerfConfig } from "./vitest.perf-shared.ts";

export default defineConfig(async () =>
  mergeConfig(await createPerfConfig(), {
    test: {
      watch: false,
      benchmark: {
        include: ["benchmark/alternatives.local-bench.ts"],
      },
    },
  }),
);
