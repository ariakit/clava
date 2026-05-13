import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "vitest";

const exec = promisify(execFile);
const root = path.join(import.meta.dirname, "..");
const scriptPath = path.join(import.meta.dirname, "bundle-size.ts");
let buildPromise: Promise<unknown> | undefined;

interface BundleSizeReport {
  minifiedBytes: number;
  gzipBytes: number;
}

function buildPackage() {
  buildPromise ??= exec("pnpm", ["--dir", root, "build"]);
  return buildPromise;
}

test("measures production bundle size", async () => {
  try {
    await access(path.join(root, "packages/clava/dist/index.js"));
  } catch {
    await buildPackage();
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "clava-bundle-size-test-"));
  try {
    const output = path.join(tempDir, "bundle-size.json");

    await exec(process.execPath, [
      scriptPath,
      "--source-root",
      root,
      "--output",
      output,
    ]);

    const report = JSON.parse(
      await readFile(output, "utf-8"),
    ) as BundleSizeReport;

    expect(report.minifiedBytes).toBeGreaterThan(0);
    expect(report.gzipBytes).toBeGreaterThan(0);
    expect(report.gzipBytes).toBeLessThanOrEqual(report.minifiedBytes);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}, 60_000);
