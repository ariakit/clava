import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { writeFileIfChanged } from "./write-if-changed.ts";

export interface GenerateChangelogPageOptions {
  outputFile: URL;
  sourceFile: URL;
}

export async function generateChangelogPage(
  options: GenerateChangelogPageOptions,
): Promise<void> {
  const outputFile = fileURLToPath(options.outputFile);
  const sourceFile = fileURLToPath(options.sourceFile);
  const content = await fs.readFile(sourceFile, "utf8");
  const normalizedContent = stripLeadingHeading(content).trim();

  const page = `---
title: Changelog
description: Release history for the current Clava docs line.
---

This page is generated at build time from \`packages/clava/CHANGELOG.md\`.

${normalizedContent}
`;

  await writeFileIfChanged(outputFile, page);
}

function stripLeadingHeading(value: string): string {
  return value.replace(/^# [^\n]+\n+/, "");
}
