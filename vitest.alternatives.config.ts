import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    watch: false,
    benchmark: {
      include: ["benchmark/alternatives.local-bench.ts"],
      // Disable v5 getter-call tracking to retain the v4 measurement setup.
      // https://github.com/vitest-dev/vitest/blob/f441c6fab25e579c5b7dd3dd50538416f415fbae/packages/vitest/src/runtime/worker.ts#L52-L54
      suppressExportGetterWarnings: true,
    },
  },
});
