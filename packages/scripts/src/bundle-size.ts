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

export interface BundleSizeMeasurement {
  minifiedBytes: number;
  gzipBytes: number;
}

export interface BundleSizeResult {
  cvSplitProps: BundleSizeMeasurement;
  fullApi: BundleSizeMeasurement;
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

export async function measureBundleSize({
  sourceRoot,
  output,
}: BundleSizeOptions): Promise<BundleSizeResult> {
  const packageEntry = path.join(sourceRoot, "packages/clava/dist/index.js");
  const tempDir = await mkdtemp(path.join(tmpdir(), "clava-bundle-size-"));

  try {
    const entry = path.join(tempDir, "entry.js");
    const bundle = path.join(tempDir, "dist/bundle.js");
    const packageUrl = pathToFileURL(packageEntry).href;

    const measureEntry = async (
      source: string,
    ): Promise<BundleSizeMeasurement> => {
      await writeFile(entry, `${source}\n`);
      await build(createBundleSizeBuildConfig({ entry, root: tempDir }));

      const code = stripBundleRegionComments(await readFile(bundle, "utf-8"));
      return {
        minifiedBytes: Buffer.byteLength(code),
        gzipBytes: gzipSync(code).byteLength,
      };
    };

    // Re-exporting keeps these APIs live while allowing the rest of the public
    // surface to be tree-shaken from the representative consumer bundle.
    const cvSplitProps = await measureEntry(
      `export { cv, splitProps } from ${JSON.stringify(packageUrl)};`,
    );
    const fullApi = await measureEntry(
      `export * from ${JSON.stringify(packageUrl)};`,
    );
    const result = {
      cvSplitProps,
      fullApi,
    };

    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function formatMeasurement(result: BundleSizeMeasurement) {
  return `${(result.minifiedBytes / 1000).toFixed(2)} kB minified, ${(result.gzipBytes / 1000).toFixed(2)} kB gzip`;
}

function formatResult({ cvSplitProps, fullApi }: BundleSizeResult) {
  return [
    `Bundle size for import { cv, splitProps } from "clava": ${formatMeasurement(cvSplitProps)}`,
    `Full API bundle size: ${formatMeasurement(fullApi)}`,
  ].join("\n");
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
