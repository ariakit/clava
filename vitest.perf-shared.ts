import path from "node:path";
import type { ViteUserConfig } from "vitest/config";
import { buildPackageBundle } from "./packages/scripts/src/bundle-size.ts";

/**
 * Points `clava` at the package as an application bundles it, so a benchmark
 * measures what a consumer ships.
 *
 * `dist` keeps `process.env.NODE_ENV` intact so consumers can replace it, and
 * Vitest cannot fold it away: it deletes any `process.env.*` `define` key and
 * assigns the value at runtime instead, which leaves the read in place on every
 * guarded path. Only a real bundle removes it, along with the warning
 * machinery behind it.
 *
 * See https://github.com/ariakit/clava/issues/500.
 */
export async function createPerfConfig(): Promise<ViteUserConfig> {
  const sourceRoot = import.meta.dirname;
  const bundle = await buildPackageBundle({
    sourceRoot,
    outDir: path.join(sourceRoot, "node_modules/.cache/clava-perf"),
  });

  return {
    resolve: {
      alias: {
        clava: bundle,
      },
    },
  };
}
