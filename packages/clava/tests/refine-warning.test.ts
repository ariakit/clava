import { expect, test } from "vitest";
import { formatCreationStack } from "../src/refine-warning.ts";

test("formatCreationStack returns the first app frame", () => {
  const stack = [
    "Error",
    "    at captureCreationFrame (/repo/packages/clava/src/refine-warning.ts:31:10)",
    "    at cv (/repo/packages/clava/src/index.ts:734:9)",
    "    at eval (/repo/app/src/button.ts:12:21)",
    "    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)",
  ].join("\n");

  expect(formatCreationStack({ stack })).toBe(
    "    at eval (/repo/app/src/button.ts:12:21)",
  );
});

test("formatCreationStack omits dependency and runtime frames", () => {
  const stack = [
    "Error",
    "    at captureCreationFrame (/repo/packages/clava/src/refine-warning.ts:31:10)",
    "    at cv(/repo/packages/clava/src/index.ts:734:9)",
    "    at eval (/repo/node_modules/package/index.js:1:1)",
    "    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)",
  ].join("\n");

  expect(formatCreationStack({ stack })).toBeUndefined();
});
