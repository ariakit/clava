import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { writeFileIfChanged } from "../src/lib/write-if-changed.ts";

const tempDirectories: string[] = [];

afterEach(async () => {
  for (const directory of tempDirectories) {
    await rm(directory, { force: true, recursive: true });
  }
  tempDirectories.length = 0;
});

test("writeFileIfChanged skips unchanged content", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "clava-write-if-changed-"),
  );
  tempDirectories.push(directory);

  const filePath = path.join(directory, "page.mdx");

  expect(await writeFileIfChanged(filePath, "first")).toBe(true);
  expect(await writeFileIfChanged(filePath, "first")).toBe(false);
  expect(await writeFileIfChanged(filePath, "second")).toBe(true);
  expect(await readFile(filePath, "utf8")).toBe("second");
});
