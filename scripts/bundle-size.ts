import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";

interface Options {
  sourceRoot: string;
  output: string;
}

function readOptions(): Options {
  const args = process.argv.slice(2);
  let sourceRoot = process.cwd();
  let output = path.join(
    process.cwd(),
    ".perf-results/bundle-size-current.json",
  );

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

async function measureBundleSize({ sourceRoot, output }: Options) {
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
      },
    });

    const code = await readFile(bundle);
    const result = {
      minifiedBytes: code.byteLength,
      gzipBytes: gzipSync(code).byteLength,
    };

    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
    console.log(
      `Bundle size: ${result.minifiedBytes} B minified, ${result.gzipBytes} B gzip`,
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

await measureBundleSize(readOptions());
