import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";
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

    // Re-export the full public API so the metric tracks the published
    // surface plus its bundled runtime dependencies, not one tree-shaken use.
    await writeFile(entry, `export * from ${JSON.stringify(packageUrl)};\n`);

    await build({
      configFile: false,
      logLevel: "silent",
      root: tempDir,
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
    });

    // Rolldown's region comments include resolved module paths, which would
    // make identical bundles measure differently across worktree directories.
    const code = (await readFile(bundle, "utf-8")).replace(
      /^\/\/#(?:end)?region.*\r?\n/gm,
      "",
    );
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
