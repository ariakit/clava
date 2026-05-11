import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { rspack } from "@rspack/core";
import { build as esbuild } from "esbuild";
import { rolldown } from "rolldown";
import { build as viteBuild } from "vite";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import webpack from "webpack";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const exec = promisify(execFile);
const warningText = "Maximum computed update iterations exceeded";

let fixtureDir: string | undefined;
let fixtureEntry: string | undefined;

async function createFixture() {
  const tempDir = await mkdtemp(join(tmpdir(), "clava-bundler-"));
  const nodeModulesDir = join(tempDir, "node_modules");
  const clavaDir = join(nodeModulesDir, "clava");
  await mkdir(clavaDir, { recursive: true });
  await cp(join(root, "dist"), join(clavaDir, "dist"), { recursive: true });
  await cp(join(root, "src"), join(clavaDir, "src"), { recursive: true });
  const clsxDir = await realpath(join(root, "node_modules/clsx"));
  await cp(clsxDir, join(nodeModulesDir, "clsx"), { recursive: true });
  await writeFile(
    join(clavaDir, "package.json"),
    await readFile(join(root, "package.json"), "utf8"),
  );

  const entry = join(tempDir, "entry.js");
  await writeFile(
    entry,
    `
import { cv } from "clava";

const component = cv({
  variants: { size: { sm: "sm", lg: "lg" } },
  defaultVariants: { size: "sm" },
  computed: ({ variants, setVariants }) => {
    setVariants({ size: variants.size === "sm" ? "lg" : "sm" });
  },
});

component();
`,
  );
  return { tempDir, entry };
}

function getFixtureEntry() {
  if (!fixtureEntry) {
    expect.fail("Expected bundler fixture to be initialized");
  }
  return fixtureEntry;
}

function expectNoWarningCode(name: string, code: string) {
  expect(code, `${name} bundle should omit warning text`).not.toContain(
    warningText,
  );
  expect(code, `${name} bundle should omit console.warn`).not.toContain(
    "console.warn",
  );
}

async function bundleWithEsbuild() {
  const result = await esbuild({
    entryPoints: [getFixtureEntry()],
    bundle: true,
    minify: true,
    write: false,
    format: "esm",
    platform: "browser",
    conditions: ["production"],
  });
  const outputFile = result.outputFiles[0];
  if (!outputFile) {
    expect.fail("Expected esbuild to emit an output file");
  }
  return outputFile.text;
}

async function bundleWithVite() {
  vi.stubEnv("NODE_ENV", "production");
  try {
    const result = await viteBuild({
      root: dirname(getFixtureEntry()),
      configFile: false,
      logLevel: "silent",
      build: {
        write: false,
        minify: "esbuild",
        rollupOptions: {
          input: getFixtureEntry(),
        },
      },
    });
    if (!Array.isArray(result) && !("output" in result)) {
      expect.fail("Expected Vite to emit output files");
    }
    const outputs = Array.isArray(result)
      ? result.flatMap((output) => output.output)
      : result.output;
    return outputs
      .map((output) => (output.type === "chunk" ? output.code : ""))
      .join("\n");
  } finally {
    vi.unstubAllEnvs();
  }
}

async function bundleWithRolldown() {
  const bundle = await rolldown({
    input: getFixtureEntry(),
    platform: "browser",
    resolve: {
      conditionNames: ["import", "production", "browser", "default"],
    },
  });
  const result = await bundle.generate({ format: "esm", minify: true });
  return result.output
    .map((output) => (output.type === "chunk" ? output.code : ""))
    .join("\n");
}

async function bundleWithWebpack() {
  const outputDir = join(dirname(getFixtureEntry()), "webpack-dist");
  await new Promise<void>((resolve, reject) => {
    webpack(
      {
        mode: "production",
        target: "web",
        context: dirname(getFixtureEntry()),
        entry: getFixtureEntry(),
        output: { path: outputDir, filename: "bundle.js" },
        stats: "errors-only",
      },
      (error, stats) => {
        if (error) {
          reject(error);
          return;
        }
        if (stats?.hasErrors()) {
          reject(new Error(stats.toString({ all: false, errors: true })));
          return;
        }
        resolve();
      },
    );
  });
  return readFile(join(outputDir, "bundle.js"), "utf8");
}

async function bundleWithRspack() {
  const outputDir = join(dirname(getFixtureEntry()), "rspack-dist");
  await new Promise<void>((resolve, reject) => {
    rspack(
      {
        mode: "production",
        target: "web",
        context: dirname(getFixtureEntry()),
        entry: getFixtureEntry(),
        output: { path: outputDir, filename: "bundle.js" },
        stats: "errors-only",
      },
      (error, stats) => {
        if (error) {
          reject(error);
          return;
        }
        if (stats?.hasErrors()) {
          reject(new Error(stats.toString({ all: false, errors: true })));
          return;
        }
        resolve();
      },
    );
  });
  return readFile(join(outputDir, "bundle.js"), "utf8");
}

async function resolveWarningModule(conditions: string[] = []) {
  const { stdout } = await exec(
    "node",
    [
      ...conditions.map((condition) => `--conditions=${condition}`),
      "--input-type=module",
      "-e",
      "console.log(await import.meta.resolve('#clava/warn'))",
    ],
    { cwd: root },
  );

  return fileURLToPath(stdout.trim());
}

beforeAll(async () => {
  await exec("pnpm", ["--dir", root, "build"]);
  const fixture = await createFixture();
  fixtureDir = fixture.tempDir;
  fixtureEntry = fixture.entry;
}, 60_000);

afterAll(async () => {
  if (!fixtureDir) return;
  await rm(fixtureDir, { recursive: true, force: true });
});

test("build emits conditional warning modules for consumers", async () => {
  const indexCode = await readFile(join(root, "dist/index.js"), "utf8");
  const warnCode = await readFile(join(root, "dist/warn.js"), "utf8");
  const warnNoopCode = await readFile(join(root, "dist/warn.noop.js"), "utf8");

  expect(indexCode).toContain('from "#clava/warn"');
  expect(indexCode).not.toMatch(/process\.env\.NODE_ENV !== "production"/);
  expect(warnCode).toContain("console.warn");
  expect(warnCode).not.toContain(warningText);
  expect(warnNoopCode).not.toContain("console.warn");
  expect(warnNoopCode).not.toContain(warningText);
});

test("source condition resolves source warning module", async () => {
  await expect(resolveWarningModule(["source"])).resolves.toBe(
    join(root, "src/warn.ts"),
  );
});

test("production condition resolves noop warning module", async () => {
  await expect(resolveWarningModule(["production"])).resolves.toBe(
    join(root, "dist/warn.noop.js"),
  );
});

test("development condition resolves warning module", async () => {
  await expect(resolveWarningModule(["development"])).resolves.toBe(
    join(root, "dist/warn.js"),
  );
});

test("default condition resolves noop warning module", async () => {
  await expect(resolveWarningModule()).resolves.toBe(
    join(root, "dist/warn.noop.js"),
  );
});

const bundlers: [string, () => Promise<string>][] = [
  ["esbuild", bundleWithEsbuild],
  ["vite", bundleWithVite],
  ["rolldown", bundleWithRolldown],
  ["webpack", bundleWithWebpack],
  ["rspack", bundleWithRspack],
];

test.each(bundlers)(
  "%s production bundle removes computed warnings",
  async (name, bundle) => {
    const code = await bundle();
    expectNoWarningCode(name, code);
  },
  60_000,
);
