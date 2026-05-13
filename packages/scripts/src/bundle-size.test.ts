import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { withPackageBuildLock } from "test-utils/build-lock";
import { expect, test } from "vitest";

const exec = promisify(execFile);
const root = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(import.meta.dirname, "index.ts");
let buildPromise: Promise<unknown> | undefined;

interface BundleSizeReport {
  minifiedBytes: number;
  gzipBytes: number;
}

function buildPackage() {
  buildPromise ??= exec("pnpm", ["--dir", root, "build"]);
  return buildPromise;
}

async function withBuiltPackage<T>(callback: () => Promise<T>) {
  return withPackageBuildLock(async () => {
    try {
      await access(path.join(root, "packages/clava/dist/index.js"));
    } catch {
      await buildPackage();
    }
    return callback();
  });
}

test("measures production bundle size", async () => {
  await withBuiltPackage(async () => {
    const tempDir = await mkdtemp(
      path.join(tmpdir(), "clava-bundle-size-test-"),
    );
    try {
      const output = path.join(tempDir, "bundle-size.json");

      await exec(process.execPath, [
        scriptPath,
        "bundle-size",
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
  });
}, 60_000);

test("does not include source paths in measured size", async () => {
  await withBuiltPackage(async () => {
    const tempDir = await mkdtemp(
      path.join(tmpdir(), "clava-bundle-size-test-"),
    );
    try {
      const linkedRoot = path.join(tempDir, "clava-link");
      const realOutput = path.join(tempDir, "real.json");
      const linkOutput = path.join(tempDir, "link.json");

      await symlink(root, linkedRoot);

      await exec(process.execPath, [
        scriptPath,
        "bundle-size",
        "--source-root",
        root,
        "--output",
        realOutput,
      ]);
      await exec(process.execPath, [
        scriptPath,
        "bundle-size",
        "--source-root",
        linkedRoot,
        "--output",
        linkOutput,
      ]);

      expect(JSON.parse(await readFile(linkOutput, "utf-8"))).toEqual(
        JSON.parse(await readFile(realOutput, "utf-8")),
      );
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
}, 60_000);
