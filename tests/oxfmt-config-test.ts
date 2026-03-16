import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const workspaceDir = resolve(testDir, "..");
const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length) {
    const tempDir = tempDirs.pop();
    if (!tempDir) continue;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("discovers the root oxfmt.config.ts file", () => {
  const tempDir = mkdtempSync(join(workspaceDir, ".tmp-oxfmt-config-"));
  tempDirs.push(tempDir);

  const filePath = join(tempDir, "fixture.ts");
  writeFileSync(
    filePath,
    [
      'import react from "react";',
      'import { readFileSync } from "node:fs";',
      "",
    ].join("\n"),
  );

  execFileSync("corepack", ["pnpm", "exec", "oxfmt", filePath], {
    cwd: workspaceDir,
    stdio: "pipe",
  });

  expect(readFileSync(filePath, "utf8")).toBe(
    [
      'import { readFileSync } from "node:fs";',
      'import react from "react";',
      "",
    ].join("\n"),
  );
});
