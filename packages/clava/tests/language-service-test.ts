import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterEach, describe, expect, test } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(testDir, "..");
const sourceDir = resolve(packageDir, "src");
const workspaceDir = resolve(packageDir, "../..");
const tempDirs: string[] = [];

interface LanguageServiceFixture {
  consumerFile: string;
  consumerSource: string;
  service: ts.LanguageService;
}

function createCompilerOptions(): ts.CompilerOptions {
  return {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    allowImportingTsExtensions: true,
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    lib: ["ES2020", "DOM", "DOM.Iterable"],
    customConditions: ["source"],
  };
}

function getFixturePosition(source: string, pattern: string): number {
  const position = source.indexOf(pattern);
  if (position === -1) {
    throw new Error(`Pattern not found in fixture source: ${pattern}`);
  }
  return position;
}

function createLanguageServiceHost(
  scriptFileNames: string[],
  currentDirectory: string,
  options: ts.CompilerOptions,
): ts.LanguageServiceHost {
  return {
    getCompilationSettings: () => options,
    getScriptFileNames: () => scriptFileNames,
    getScriptVersion: () => "0",
    getScriptSnapshot: (fileName) => {
      if (!ts.sys.fileExists(fileName)) return;
      return ts.ScriptSnapshot.fromString(readFileSync(fileName, "utf8"));
    },
    getCurrentDirectory: () => currentDirectory,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: (fileName) => ts.sys.fileExists(fileName),
    readFile: (fileName) => ts.sys.readFile(fileName),
    readDirectory: (...args) => ts.sys.readDirectory(...args),
    directoryExists: (directoryName) => ts.sys.directoryExists(directoryName),
    getDirectories: (directoryName) => ts.sys.getDirectories(directoryName),
    resolveModuleNames: (moduleNames, containingFile) => {
      return moduleNames.map((moduleName) => {
        return ts.resolveModuleName(moduleName, containingFile, options, ts.sys)
          .resolvedModule;
      });
    },
  };
}

function createLanguageServiceFixture(
  consumerSource: string,
): LanguageServiceFixture {
  const tempDir = mkdtempSync(join(workspaceDir, ".tmp-language-service-"));
  tempDirs.push(tempDir);

  const fixtureSourceDir = join(tempDir, "src");
  mkdirSync(fixtureSourceDir, { recursive: true });

  for (const fileName of ["index.ts", "types.ts", "utils.ts"]) {
    writeFileSync(
      join(fixtureSourceDir, fileName),
      readFileSync(join(sourceDir, fileName), "utf8"),
    );
  }

  const consumerFile = join(tempDir, "consumer.ts");
  writeFileSync(consumerFile, consumerSource);

  const options = createCompilerOptions();
  const scriptFileNames = [
    consumerFile,
    join(fixtureSourceDir, "index.ts"),
    join(fixtureSourceDir, "types.ts"),
    join(fixtureSourceDir, "utils.ts"),
  ];

  const host = createLanguageServiceHost(scriptFileNames, tempDir, options);
  const service = ts.createLanguageService(host);

  return { consumerFile, consumerSource, service };
}

function getVariantFixtureSource() {
  return `import { cv } from "./src/index.ts";

const button = cv({
  variants: {
    size: { sm: "sm", lg: "lg" },
  },
});

button({
  size: "sm",
});
`;
}

afterEach(() => {
  while (tempDirs.length) {
    const tempDir = tempDirs.pop();
    if (!tempDir) continue;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("TypeScript language service", () => {
  test("goes to the local variant definition from a variant prop usage", () => {
    const fixture = createLanguageServiceFixture(getVariantFixtureSource());
    const definitionStart = getFixturePosition(
      fixture.consumerSource,
      "size: { sm",
    );
    const usageStart = getFixturePosition(fixture.consumerSource, 'size: "sm"');
    const definitions =
      fixture.service.getDefinitionAtPosition(
        fixture.consumerFile,
        usageStart + 1,
      ) ?? [];

    expect(definitions).toHaveLength(1);
    expect(definitions[0]).toMatchObject({
      fileName: fixture.consumerFile,
      textSpan: { start: definitionStart, length: 4 },
    });
  });

  test("renames variant prop usages when renaming the variant definition", () => {
    const fixture = createLanguageServiceFixture(getVariantFixtureSource());
    const definitionStart = getFixturePosition(
      fixture.consumerSource,
      "size: { sm",
    );
    const usageStart = getFixturePosition(fixture.consumerSource, 'size: "sm"');
    const renameLocations =
      fixture.service.findRenameLocations(
        fixture.consumerFile,
        definitionStart + 1,
        false,
        false,
        { providePrefixAndSuffixTextForRename: true },
      ) ?? [];

    const renameStarts = renameLocations
      .filter((location) => location.fileName === fixture.consumerFile)
      .map((location) => location.textSpan.start);

    expect(renameStarts).toHaveLength(2);
    expect(renameStarts).toContain(definitionStart);
    expect(renameStarts).toContain(usageStart);
  });
});
