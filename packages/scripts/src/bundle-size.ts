import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { type InlineConfig, build } from "vite";
import { isDirectEntry } from "./is-direct-entry.ts";

export interface BundleSizeOptions {
  sourceRoot: string;
  output: string;
}

export interface BundleSizeResult {
  minifiedBytes: number;
  gzipBytes: number;
}

export interface BundleSizeRunResult {
  result: BundleSizeResult;
  stdout: string;
}

interface BundleSizeBuildConfigOptions {
  entry: string;
  root: string;
}

export function createBundleSizeBuildConfig({
  entry,
  root,
}: BundleSizeBuildConfigOptions): InlineConfig {
  return {
    configFile: false,
    logLevel: "silent",
    root,
    mode: "production",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    build: {
      emptyOutDir: true,
      lib: {
        entry,
        fileName: () => "bundle.js",
        formats: ["es"],
      },
      minify: true,
      outDir: "dist",
      // Vite's default ES library output can optimize the chunk without
      // compact-printing it, so force Rolldown to measure real minified code.
      rolldownOptions: {
        output: {
          minify: true,
        },
      },
    },
  };
}

export function stripBundleRegionComments(code: string) {
  // Rolldown's region comments include resolved module paths, which would
  // make identical bundles measure differently across worktree directories.
  return code.replace(/^\/\/#(?:end)?region.*\r?\n/gm, "");
}

function readOptions(
  args = process.argv.slice(2),
  cwd = process.cwd(),
): BundleSizeOptions {
  let sourceRoot = cwd;
  let output = path.join(cwd, ".perf-results/bundle-size-current.json");

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const value = args[i + 1];
    if (arg === "--source-root" && value) {
      sourceRoot = value;
      i += 1;
    } else if (arg === "--output" && value) {
      output = value;
      i += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return {
    sourceRoot: path.resolve(sourceRoot),
    output: path.resolve(output),
  };
}

export interface BuildPackageBundleOptions {
  sourceRoot: string;
  outDir: string;
}

/**
 * Builds the package the way an application bundles it and returns the path to
 * the result. The bundle metric and the benchmarks both go through here, so
 * they describe the same artifact.
 */
export async function buildPackageBundle({
  sourceRoot,
  outDir,
}: BuildPackageBundleOptions): Promise<string> {
  const packageEntry = path.join(sourceRoot, "packages/clava/dist/index.js");
  const entry = path.join(outDir, "entry.js");

  await mkdir(outDir, { recursive: true });
  // Re-export the full public API so the bundle covers the published surface
  // plus its bundled runtime dependencies, not one tree-shaken use.
  await writeFile(
    entry,
    `export * from ${JSON.stringify(pathToFileURL(packageEntry).href)};\n`,
  );

  await build(createBundleSizeBuildConfig({ entry, root: outDir }));

  return path.join(outDir, "dist/bundle.js");
}

export async function measureBundleSize({
  sourceRoot,
  output,
}: BundleSizeOptions): Promise<BundleSizeResult> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "clava-bundle-size-"));

  try {
    const bundle = await buildPackageBundle({ sourceRoot, outDir: tempDir });

    const code = stripBundleRegionComments(await readFile(bundle, "utf-8"));
    const result = {
      minifiedBytes: Buffer.byteLength(code),
      gzipBytes: gzipSync(code).byteLength,
    };

    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function formatResult(result: BundleSizeResult) {
  return `Bundle size: ${(result.minifiedBytes / 1000).toFixed(2)} kB minified, ${(result.gzipBytes / 1000).toFixed(2)} kB gzip`;
}

export async function runBundleSize(
  args?: string[],
): Promise<BundleSizeRunResult> {
  const result = await measureBundleSize(readOptions(args));
  return {
    result,
    stdout: formatResult(result),
  };
}

if (isDirectEntry(import.meta.url)) {
  const { stdout } = await runBundleSize();
  console.log(stdout);
}
