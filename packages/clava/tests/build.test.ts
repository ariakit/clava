import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { withPackageBuildLock } from "test-utils/build-lock";
import { build } from "vite";
import { expect, test } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const exec = promisify(execFile);
let buildPromise: Promise<unknown> | undefined;

function buildPackage() {
  buildPromise ??= exec("pnpm", ["--dir", root, "build"]);
  return buildPromise;
}

test("build preserves the production warning guard for consumers", async () => {
  await withPackageBuildLock(async () => {
    await buildPackage();

    const code = await readFile(join(root, "dist/index.js"), "utf8");
    expect(code).toMatch(
      /warnRefineLimit[\s\S]*?process\.env\.NODE_ENV === "production"[\s\S]*?console\.warn\(/,
    );
  });
}, 60_000);

test("vite removes warning logic from the production bundle", async () => {
  await withPackageBuildLock(async () => {
    await buildPackage();

    const tempDir = await mkdtemp(join(tmpdir(), "clava-vite-"));
    try {
      const entry = join(tempDir, "entry.js");
      const bundle = join(tempDir, "dist/bundle.js");
      const clavaUrl = pathToFileURL(join(root, "dist/index.js")).href;

      await writeFile(
        entry,
        `
        import { cv } from ${JSON.stringify(clavaUrl)};

        export const button = cv({
          variants: {
            tone: {
              primary: "primary",
            },
          },
          refine({ setVariants }) {
            setVariants({ tone: "primary" });
          },
        });

        button();
      `,
      );

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

      const code = await readFile(bundle, "utf8");
      expect(code).not.toContain("console.warn");
      expect(code).not.toContain("Clava: Maximum refine iterations exceeded");
      expect(code).not.toContain("Variant(s) that did not stabilize");
      expect(code).not.toContain("Component created at");
      expect(code).not.toContain("captureStackTrace");
      expect(code).not.toMatch(/\.warned\b|["']warned["']/);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
}, 60_000);
