import { expect, test } from "vitest";
import { virtualModuleOptimizeDepsExclude } from "../src/lib/vite-deps.ts";

test("virtual modules stay out of Vite dep optimization", () => {
  expect(virtualModuleOptimizeDepsExclude).toEqual([
    "@astrojs/starlight",
    "@astrojs/starlight/utils/translations.ts",
    "virtual:astro:middleware",
    "virtual:starlight/plugin-translations",
    "virtual:starlight/project-context",
    "virtual:starlight/user-config",
  ]);
});
