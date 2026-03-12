import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { writeFileIfChanged } from "./write-if-changed.ts";

export interface ApiReferenceSymbol {
  kind: ApiReferenceKind;
  name: string;
  signature: string;
  slug: string;
  sourcePath: string;
  sourceUrl: string;
  summary?: string;
}

export interface ApiReferenceGroup {
  kind: ApiReferenceKind;
  label: string;
  symbols: ApiReferenceSymbol[];
}

export interface ApiReferenceDocument {
  groups: ApiReferenceGroup[];
}

export interface GenerateApiReferenceOptions {
  outputDir: URL;
  repoBaseUrl: string;
  sourceFile: URL;
  tsconfigFile: URL;
}

type ApiReferenceKind = "constant" | "function" | "interface" | "type";

const groupOrder: Record<ApiReferenceKind, number> = {
  function: 0,
  constant: 1,
  interface: 2,
  type: 3,
};

const groupLabels: Record<ApiReferenceKind, string> = {
  constant: "Constants",
  function: "Functions",
  interface: "Interfaces",
  type: "Types",
};

export async function generateApiReference(
  options: GenerateApiReferenceOptions,
): Promise<ApiReferenceDocument> {
  const outputDir = fileURLToPath(options.outputDir);
  const sourceFile = fileURLToPath(options.sourceFile);
  const tsconfigFile = fileURLToPath(options.tsconfigFile);
  const document = createApiReferenceDocument({
    repoBaseUrl: options.repoBaseUrl,
    sourceFile,
    tsconfigFile,
  });

  await fs.mkdir(outputDir, { recursive: true });
  const files = buildApiReferenceFiles(document);
  const existingFiles = await fs.readdir(outputDir);
  const nextFileNames = new Set(files.map((file) => file.name));

  for (const existingFile of existingFiles) {
    if (nextFileNames.has(existingFile)) {
      continue;
    }
    await fs.rm(path.join(outputDir, existingFile), { force: true });
  }

  for (const file of files) {
    await writeFileIfChanged(path.join(outputDir, file.name), file.content);
  }

  return document;
}

interface ApiReferenceFile {
  content: string;
  name: string;
}

interface CreateApiReferenceDocumentOptions {
  repoBaseUrl: string;
  sourceFile: string;
  tsconfigFile: string;
}

function createApiReferenceDocument(
  options: CreateApiReferenceDocumentOptions,
): ApiReferenceDocument {
  const repoRoot = path.resolve(path.dirname(options.tsconfigFile), "../..");
  const program = createProgram(options.tsconfigFile);
  const checker = program.getTypeChecker();
  const moduleSource = program.getSourceFile(options.sourceFile);
  if (!moduleSource) {
    throw new Error(`Missing source file: ${options.sourceFile}`);
  }
  const moduleSymbol = checker.getSymbolAtLocation(moduleSource);
  if (!moduleSymbol) {
    throw new Error(`Missing module symbol for: ${options.sourceFile}`);
  }

  const groups = new Map<ApiReferenceKind, ApiReferenceSymbol[]>();
  for (const exportSymbol of checker.getExportsOfModule(moduleSymbol)) {
    const symbol = resolveAliasSymbol(exportSymbol, checker);
    const declaration = getPrimaryDeclaration(symbol);
    if (!declaration) {
      continue;
    }

    const kind = getReferenceKind(symbol, declaration);
    const summary = readSummary(symbol, checker);
    const slug = toKebabCase(exportSymbol.getName());
    const signature = getSignature(symbol, declaration, checker);
    const sourcePath = path.relative(
      repoRoot,
      declaration.getSourceFile().fileName,
    );
    const sourceUrl = new URL(
      `${sourcePath.replaceAll(path.sep, "/")}#L${
        ts.getLineAndCharacterOfPosition(
          declaration.getSourceFile(),
          declaration.getStart(),
        ).line + 1
      }`,
      ensureTrailingSlash(options.repoBaseUrl),
    ).toString();

    const item: ApiReferenceSymbol = {
      kind,
      name: exportSymbol.getName(),
      signature,
      slug,
      sourcePath: sourcePath.replaceAll(path.sep, "/"),
      sourceUrl,
      summary,
    };
    const group = groups.get(kind);
    if (group) {
      group.push(item);
      continue;
    }
    groups.set(kind, [item]);
  }

  const orderedGroups = Array.from(groups.entries())
    .toSorted(
      ([leftKind], [rightKind]) => groupOrder[leftKind] - groupOrder[rightKind],
    )
    .map(([kind, symbols]) => ({
      kind,
      label: groupLabels[kind],
      symbols: symbols.toSorted((left, right) =>
        left.name.localeCompare(right.name),
      ),
    }));

  return { groups: orderedGroups };
}

function buildApiReferenceFiles(
  document: ApiReferenceDocument,
): ApiReferenceFile[] {
  const files: ApiReferenceFile[] = [
    {
      content: buildIndexPage(document),
      name: "index.mdx",
    },
  ];

  for (const group of document.groups) {
    for (const symbol of group.symbols) {
      files.push({
        content: buildSymbolPage(symbol),
        name: `${symbol.slug}.mdx`,
      });
    }
  }

  return files;
}

function buildIndexPage(document: ApiReferenceDocument): string {
  const lines = [
    "---",
    "title: API Symbols",
    "description: Generated reference for every public Clava symbol.",
    "---",
    "",
    "This section is generated at build time from the public exports in `packages/clava/src/index.ts` and the related declarations they point to.",
    "",
    "Use [`Public API`](/reference/public-api/) for the curated overview, then come here for signatures, summaries, and source links.",
    "",
  ];

  for (const group of document.groups) {
    lines.push(`## ${group.label}`, "");
    for (const symbol of group.symbols) {
      const summary = symbol.summary ? ` - ${symbol.summary}` : "";
      lines.push(
        `- [\`${symbol.name}\`](/reference/api/${symbol.slug}/)${summary}`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function buildSymbolPage(symbol: ApiReferenceSymbol): string {
  const summary = symbol.summary
    ? `${symbol.summary}\n`
    : "Reference entry generated from the current public export.\n";

  return `---
title: ${symbol.name}
description: ${escapeFrontmatter(summary.trim())}
---

## Summary

${summary}
## Signature

\`\`\`ts
${symbol.signature}
\`\`\`

## Source

- [\`${symbol.sourcePath}\`](${symbol.sourceUrl})
`;
}

function createProgram(tsconfigFile: string): ts.Program {
  const configFile = ts.readConfigFile(tsconfigFile, (fileName) =>
    ts.sys.readFile(fileName),
  );
  if (configFile.error) {
    throw new Error(
      ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"),
    );
  }
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsconfigFile),
  );
  if (parsedConfig.errors.length > 0) {
    const messages = parsedConfig.errors.map((error) =>
      ts.flattenDiagnosticMessageText(error.messageText, "\n"),
    );
    throw new Error(messages.join("\n"));
  }
  return ts.createProgram({
    options: parsedConfig.options,
    rootNames: parsedConfig.fileNames,
  });
}

function resolveAliasSymbol(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): ts.Symbol {
  if (!(symbol.flags & ts.SymbolFlags.Alias)) {
    return symbol;
  }
  return checker.getAliasedSymbol(symbol);
}

function getPrimaryDeclaration(symbol: ts.Symbol): ts.Declaration | undefined {
  const declarations = symbol.getDeclarations();
  if (!declarations?.length) {
    return undefined;
  }
  for (const declaration of declarations) {
    if (ts.isFunctionDeclaration(declaration)) {
      return declaration;
    }
    if (ts.isInterfaceDeclaration(declaration)) {
      return declaration;
    }
    if (ts.isTypeAliasDeclaration(declaration)) {
      return declaration;
    }
    if (
      ts.isVariableDeclaration(declaration) ||
      ts.isBindingElement(declaration)
    ) {
      return declaration;
    }
  }
  return declarations[0];
}

function getReferenceKind(
  symbol: ts.Symbol,
  declaration: ts.Declaration,
): ApiReferenceKind {
  if (symbol.flags & ts.SymbolFlags.Function) {
    return "function";
  }
  if (ts.isFunctionDeclaration(declaration)) {
    return "function";
  }
  if (ts.isInterfaceDeclaration(declaration)) {
    return "interface";
  }
  if (ts.isTypeAliasDeclaration(declaration)) {
    return "type";
  }
  return "constant";
}

function readSummary(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): string | undefined {
  const summary = ts
    .displayPartsToString(symbol.getDocumentationComment(checker))
    .replace(/\s+/g, " ")
    .trim();
  if (!summary) {
    return undefined;
  }
  return summary;
}

function getSignature(
  symbol: ts.Symbol,
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
): string {
  if (ts.isFunctionDeclaration(declaration)) {
    return getFunctionSignature(symbol, declaration, checker);
  }
  if (
    ts.isBindingElement(declaration) ||
    ts.isVariableDeclaration(declaration)
  ) {
    return getConstantSignature(symbol, declaration, checker);
  }
  return declaration
    .getText(declaration.getSourceFile())
    .replace(/^export\s+/, "")
    .trim();
}

function getFunctionSignature(
  symbol: ts.Symbol,
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
): string {
  const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
  const signatures = type.getCallSignatures();
  if (!signatures.length) {
    return declaration
      .getText(declaration.getSourceFile())
      .replace(/^export\s+/, "")
      .trim();
  }
  const formattedSignatures = signatures.map(
    (signature) =>
      `function ${symbol.getName()}${checker.signatureToString(
        signature,
        declaration,
        ts.TypeFormatFlags.NoTruncation,
      )}`,
  );
  return formattedSignatures.join("\n");
}

function getConstantSignature(
  symbol: ts.Symbol,
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
): string {
  const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
  const typeText = checker.typeToString(
    type,
    declaration,
    ts.TypeFormatFlags.NoTruncation |
      ts.TypeFormatFlags.MultilineObjectLiterals,
  );
  return `const ${symbol.getName()}: ${typeText}`;
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replaceAll("_", "-")
    .toLowerCase();
}

function escapeFrontmatter(value: string): string {
  return JSON.stringify(value);
}

function ensureTrailingSlash(value: string): string {
  if (value.endsWith("/")) {
    return value;
  }
  return `${value}/`;
}
