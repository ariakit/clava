import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const exec = promisify(execFile);

test("build preserves the production warning guard for consumers", async () => {
  await exec("pnpm", ["--dir", root, "build"]);

  const code = await readFile(join(root, "dist/index.js"), "utf8");
  expect(code).toMatch(
    /process\.env\.NODE_ENV !== "production"[\s\S]*?console\.warn\(/,
  );
}, 60_000);
