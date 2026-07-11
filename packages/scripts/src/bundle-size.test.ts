import { execFile } from "node:child_process";
import {
  access,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { withPackageBuildLock } from "test-utils/build-lock";
import { build } from "vite";
import { expect, test } from "vitest";
import {
  type BundleSizeResult,
  createBundleSizeBuildConfig,
} from "./bundle-size.ts";

const exec = promisify(execFile);
const root = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(import.meta.dirname, "index.ts");
let buildPromise: Promise<unknown> | undefined;

function formatMeasurement({
  minifiedBytes,
  gzipBytes,
}: BundleSizeResult["cvSplitProps"]) {
  return `${(minifiedBytes / 1000).toFixed(2)} kB minified, ${(gzipBytes / 1000).toFixed(2)} kB gzip`;
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

      const { stdout } = await exec(process.execPath, [
        scriptPath,
        "bundle-size",
        "--source-root",
        root,
        "--output",
        output,
      ]);

      const report = JSON.parse(
        await readFile(output, "utf-8"),
      ) as BundleSizeResult;

      expect(stdout.trim()).toBe(
        [
          `Bundle size for import { cv, splitProps } from "clava": ${formatMeasurement(report.cvSplitProps)}`,
          `Full API bundle size: ${formatMeasurement(report.fullApi)}`,
        ].join("\n"),
      );
      for (const measurement of Object.values(report)) {
        expect(measurement.minifiedBytes).toBeGreaterThan(0);
        expect(measurement.gzipBytes).toBeGreaterThan(0);
        expect(measurement.gzipBytes).toBeLessThanOrEqual(
          measurement.minifiedBytes,
        );
      }
      expect(report.cvSplitProps.minifiedBytes).toBeLessThan(
        report.fullApi.minifiedBytes,
      );
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
}, 60_000);

test("emits compact minified output", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "clava-bundle-size-test-"));
  try {
    const entry = path.join(tempDir, "entry.js");
    const fixture = path.join(tempDir, "fixture.js");
    const bundle = path.join(tempDir, "dist/bundle.js");

    await writeFile(
      fixture,
      `
export function createLongClassName(prefix, value) {
  const normalizedPrefix = String(prefix).trim().toLowerCase();
  const normalizedValue = String(value).trim().toLowerCase();
  const segments = [
    normalizedPrefix,
    normalizedValue,
    normalizedPrefix + "-" + normalizedValue,
  ];
  return segments.filter(Boolean).join(" ");
}
`,
    );
    await writeFile(
      entry,
      `export * from ${JSON.stringify(pathToFileURL(fixture).href)};\n`,
    );

    await build(createBundleSizeBuildConfig({ entry, root: tempDir }));

    expect((await readFile(bundle, "utf-8")).trim()).not.toContain("\n");
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
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
