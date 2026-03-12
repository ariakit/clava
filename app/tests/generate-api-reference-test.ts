import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, expect, test } from "vitest";
import { generateApiReference } from "../src/lib/generate-api-reference.ts";

const tempDirectories: string[] = [];

afterEach(async () => {
  for (const directory of tempDirectories) {
    await rm(directory, { force: true, recursive: true });
  }
  tempDirectories.length = 0;
});

test("generateApiReference writes index and symbol pages", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "clava-api-reference-"));
  tempDirectories.push(outputDir);

  const document = await generateApiReference({
    outputDir: pathToFileURL(outputDir),
    repoBaseUrl: "https://github.com/ariakit/clava/blob/main/",
    sourceFile: new URL("../../packages/clava/src/index.ts", import.meta.url),
    tsconfigFile: new URL(
      "../../packages/clava/tsconfig.json",
      import.meta.url,
    ),
  });

  expect(document.groups.map((group) => group.label)).toEqual([
    "Functions",
    "Constants",
    "Interfaces",
    "Types",
  ]);

  const generatedFiles = await readdir(outputDir);
  expect(generatedFiles).toContain("index.mdx");
  expect(generatedFiles).toContain("create.mdx");
  expect(generatedFiles).toContain("variant-props.mdx");

  const indexPage = await readFile(path.join(outputDir, "index.mdx"), "utf8");
  expect(indexPage).toContain("API Symbols");
  expect(indexPage).toContain("[`create`](/reference/api/create/)");
  expect(indexPage).toContain(
    "[`VariantProps`](/reference/api/variant-props/)",
  );

  const createPage = await readFile(path.join(outputDir, "create.mdx"), "utf8");
  expect(createPage).toContain("## Signature");
  expect(createPage).toContain("## Source");
  expect(createPage).toContain("packages/clava/src/index.ts");
});
