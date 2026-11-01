import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  createBundleSizeBuildConfig,
  stripBundleRegionComments,
} from "scripts/src/bundle-size.ts";
import { withPackageBuildLock } from "test-utils/build-lock";
import ts from "typescript";
import { build } from "vite";
import { expect, test } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const exec = promisify(execFile);
let buildPromise: Promise<unknown> | undefined;

interface PackResult {
  files: { path: string }[];
}

function buildPackage() {
  buildPromise ??= exec("pnpm", ["--dir", root, "build"]);
  return buildPromise;
}

async function bundleProductionEntry(
  getSource: (packageUrl: string) => string,
) {
  await buildPackage();

  const tempDir = await mkdtemp(join(tmpdir(), "clava-vite-"));
  try {
    const entry = join(tempDir, "entry.js");
    const bundle = join(tempDir, "dist/bundle.js");
    const packageUrl = pathToFileURL(join(root, "dist/index.js")).href;

    await writeFile(entry, getSource(packageUrl));
    await build(createBundleSizeBuildConfig({ entry, root: tempDir }));

    return stripBundleRegionComments(await readFile(bundle, "utf8"));
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

// Installs the package like pnpm does: each package has its own store folder,
// and only symlinks connect them. The consumer can't resolve clsx or csstype.
async function installPackage(tempDir: string) {
  const modules = join(tempDir, "node_modules");
  const store = join(modules, ".pnpm");
  const clavaModules = join(store, "clava/node_modules");
  const clavaPackage = join(clavaModules, "clava");
  await mkdir(clavaPackage, { recursive: true });
  await cp(join(root, "dist"), join(clavaPackage, "dist"), { recursive: true });
  await cp(join(root, "package.json"), join(clavaPackage, "package.json"));
  for (const dependency of ["clsx", "csstype"]) {
    const source = await realpath(join(root, "node_modules", dependency));
    const target = join(store, dependency, "node_modules", dependency);
    await cp(source, target, { recursive: true });
    await symlink(target, join(clavaModules, dependency));
  }
  await symlink(clavaPackage, join(modules, "clava"));
}

// Returns the diagnostics that a compiler reports with `declaration: true`.
async function getDeclarationDiagnostics(compiler: string, source: string) {
  const tempDir = await mkdtemp(join(tmpdir(), "clava-declarations-"));
  try {
    await installPackage(tempDir);
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
    );
    await writeFile(join(tempDir, "consumer.ts"), source);
    await writeFile(
      join(tempDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          declaration: true,
          emitDeclarationOnly: true,
          module: "nodenext",
          moduleResolution: "nodenext",
          outDir: "out",
          skipLibCheck: true,
          strict: true,
          target: "ES2022",
          types: [],
        },
        files: ["consumer.ts"],
      }),
    );
    const bin = join(root, "../../node_modules/.bin", compiler);
    const result = await exec(bin, ["-p", tempDir, "--pretty", "false"]).catch(
      // tsc reports diagnostics to stdout and exits with a numeric code. Any
      // other error, such as a missing binary, must not read as no diagnostics.
      (error: { code: unknown; stdout: string; stderr: string }) => {
        if (typeof error.code !== "number") throw error;
        return error;
      },
    );
    // A compiler that fails to start can exit with a code and only use stderr.
    return `${result.stdout}${result.stderr}`;
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
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

test("package contains only published files", async () => {
  await withPackageBuildLock(async () => {
    await buildPackage();

    const { stdout } = await exec("pnpm", ["pack", "--dry-run", "--json"], {
      cwd: root,
    });
    const result = JSON.parse(stdout) as PackResult;

    const expectedFiles = new Set([
      "CHANGELOG.md",
      "README.md",
      "dist/index.d.ts",
      "dist/index.js",
      "dist/index.js.map",
      "license",
      "package.json",
      "src/index.ts",
      "src/refine-warning.ts",
      "src/types.ts",
      "src/utils.ts",
    ]);
    const files = new Set(result.files.map((file) => file.path));
    const missing = [...expectedFiles].filter((file) => !files.has(file));
    const extra = [...files].filter((file) => !expectedFiles.has(file));

    expect(extra).toEqual([]);
    expect(missing).toEqual([]);
  });
}, 60_000);

test("source condition loads the package source", async () => {
  await exec(
    process.execPath,
    [
      "--conditions=source",
      "--input-type=module",
      "--eval",
      `
        const resolved = import.meta.resolve("clava");
        if (!resolved.endsWith("/src/index.ts")) {
          throw new Error(\`Expected source condition, got \${resolved}\`);
        }

        import { cv } from "clava";

        const button = cv({ class: "button" });
        if (button().class !== "button") {
          throw new Error("The source condition did not load Clava");
        }
      `,
    ],
    { cwd: root },
  );
});

test("vite removes warning logic from the production bundle", async () => {
  await withPackageBuildLock(async () => {
    const code = await bundleProductionEntry(
      (packageUrl) => `
        import { cv } from ${JSON.stringify(packageUrl)};

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

    expect(code).not.toContain("console.warn");
    expect(code).not.toContain("Clava: Maximum refine iterations exceeded");
    expect(code).not.toContain("Variant(s) that did not stabilize");
    expect(code).not.toContain("Latest variant changes before warning");
    expect(code).not.toContain("Recipe created at");
    expect(code).not.toContain("captureStackTrace");
    expect(code).not.toMatch(/\.warned\b|["']warned["']/);
  });
}, 60_000);

test("vite tree shakes independent exports", async () => {
  await withPackageBuildLock(async () => {
    const cxCode = await bundleProductionEntry((packageUrl) => {
      return `export { cx } from ${JSON.stringify(packageUrl)};`;
    });
    const splitPropsCode = await bundleProductionEntry((packageUrl) => {
      return `export { splitProps } from ${JSON.stringify(packageUrl)};`;
    });

    expect(Buffer.byteLength(cxCode)).toBeLessThan(600);
    expect(Buffer.byteLength(splitPropsCode)).toBeLessThan(1500);
  });
}, 60_000);

test("generic wrappers with inferred return types emit declarations", async () => {
  await withPackageBuildLock(async () => {
    await buildPackage();

    const tempDir = await mkdtemp(join(tmpdir(), "clava-declarations-"));
    try {
      const consumer = join(tempDir, "consumer.ts");
      await writeFile(
        consumer,
        `import { cv } from "clava";

export function wrap<V extends Record<string, string>>(variants: V) {
  return cv({ variants });
}
`,
      );
      const program = ts.createProgram([consumer], {
        declaration: true,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        paths: { clava: [join(root, "dist/index.d.ts")] },
        skipLibCheck: true,
        strict: true,
        target: ts.ScriptTarget.ES2020,
        types: [],
      });
      const { diagnostics } = program.emit(
        undefined,
        () => {},
        undefined,
        true,
      );

      expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([]);
      expect(ts.getPreEmitDiagnostics(program)).toEqual([]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
}, 60_000);

test.each(["tsc", "tsc6"])(
  "exported create results emit declarations with %s",
  async (compiler) => {
    await withPackageBuildLock(async () => {
      await buildPackage();

      const diagnostics = await getDeclarationDiagnostics(
        compiler,
        `import { create } from "clava";

export const customCv = create().cv;
export const { cv, cx } = create();
export const factory = create();
export function createCv() {
  return create().cv;
}
export const jsxButton = customCv({
  variants: { size: { sm: "sm" } },
}).jsx;
`,
      );

      expect(diagnostics).toBe("");
    });
  },
  60_000,
);

test.each(["tsc", "tsc6"])(
  "exported splitProps and recipe members emit declarations with %s",
  async (compiler) => {
    await withPackageBuildLock(async () => {
      await buildPackage();

      const diagnostics = await getDeclarationDiagnostics(
        compiler,
        `import { cv, splitProps } from "clava";

const button = cv({ variants: { size: { sm: "s" } } });

export const aliasSplit = splitProps;
export const classFn = button.class;
export const styleFn = button.style;
export const getVariants = button.getVariants;
export const jsxClassFn = button.jsx.class;
export const jsxStyleFn = button.jsx.style;
export const jsxGetVariants = button.jsx.getVariants;
export const htmlClassFn = button.html.class;
export const htmlStyleFn = button.html.style;
export const htmlObjClassFn = button.htmlObj.class;
export const htmlObjStyleFn = button.htmlObj.style;
export const jsxStyle = button.jsx.style();
export const htmlObjStyle = button.htmlObj.style();
export const defaultStyle = button.style();
`,
      );

      expect(diagnostics).toBe("");
    });
  },
  60_000,
);
