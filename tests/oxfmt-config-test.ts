import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const workspaceDir = resolve(testDir, "..");
const oxfmtPath = join(
  workspaceDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "oxfmt.cmd" : "oxfmt",
);
const tempDirs: string[] = [];

function formatFixture(filePath: string) {
  try {
    execFileSync(oxfmtPath, [filePath], {
      cwd: workspaceDir,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }

    let message = `Failed to run oxfmt on ${filePath}.\n${error.message}`;

    if ("stdout" in error && typeof error.stdout === "string" && error.stdout) {
      message += `\nstdout:\n${error.stdout}`;
    }

    if ("stderr" in error && typeof error.stderr === "string" && error.stderr) {
      message += `\nstderr:\n${error.stderr}`;
    }

    const wrappedError = new Error(message);
    Object.assign(wrappedError, { cause: error });
    throw wrappedError;
  }
}

afterEach(() => {
  const dirsToRemove = [...tempDirs];
  tempDirs.length = 0;

  for (const tempDir of dirsToRemove) {
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

  formatFixture(filePath);

  expect(readFileSync(filePath, "utf8")).toBe(
    [
      'import { readFileSync } from "node:fs";',
      'import react from "react";',
      "",
    ].join("\n"),
  );
});
