import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

const resultsDir = ".perf-results";
const scriptPath = path.join(import.meta.dirname, "perf-compare.ts");
const tempDirs: string[] = [];

interface Benchmark {
  name: string;
  hz?: number;
  mean?: number;
}

function createTempDir() {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "clava-perf-")));
  tempDirs.push(dir);
  return dir;
}

function createReport(dir: string, benchmarks: Benchmark[]) {
  return {
    files: [
      {
        filepath: path.join(dir, "packages/clava/perfs/component.bench.ts"),
        groups: [
          {
            fullName: "packages/clava/perfs/component.bench.ts > cv",
            benchmarks,
          },
        ],
      },
    ],
  };
}

function writeJson(dir: string, name: string, data: unknown) {
  const filePath = path.join(dir, resultsDir, name);
  writeFileSync(filePath, JSON.stringify(data), "utf-8");
}

function runCompare({
  baseline,
  current,
}: {
  baseline?: unknown;
  current?: unknown;
}) {
  const dir = createTempDir();
  const outputDir = path.join(dir, resultsDir);
  mkdirSync(outputDir, { recursive: true });
  if (baseline) {
    writeJson(dir, "baseline.json", baseline);
  }
  if (current) {
    writeJson(dir, "current.json", current);
  }

  execFileSync(process.execPath, [scriptPath], {
    cwd: dir,
    stdio: "pipe",
  });

  return readFileSync(path.join(outputDir, "comparison.md"), "utf-8");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("perf compare", () => {
  test("formats package benchmark labels", () => {
    const dir = createTempDir();
    const outputDir = path.join(dir, resultsDir);
    mkdirSync(outputDir, { recursive: true });
    writeJson(
      dir,
      "current.json",
      createReport(dir, [
        { name: "create component with variants", hz: 100, mean: 0.01 },
      ]),
    );

    execFileSync(process.execPath, [scriptPath], {
      cwd: dir,
      stdio: "pipe",
    });

    const markdown = readFileSync(
      path.join(outputDir, "comparison.md"),
      "utf-8",
    );

    expect(markdown).toContain(
      "clava > component.bench.ts > create component with variants",
    );
    expect(markdown).not.toContain("packages/clava/perfs/");
  });

  test("reports significant regressions", () => {
    const dir = createTempDir();
    const markdown = runCompare({
      baseline: createReport(dir, [
        { name: "create component with variants", hz: 100, mean: 0.01 },
      ]),
      current: createReport(dir, [
        { name: "create component with variants", hz: 80, mean: 0.0125 },
      ]),
    });

    expect(markdown).toContain("| Benchmark | Baseline | Current | Change |");
    expect(markdown).toContain("-20% :warning:");
  });

  test("reports renamed benchmarks distinctly from missing baseline", () => {
    const dir = createTempDir();
    const markdown = runCompare({
      baseline: createReport(dir, [{ name: "old name", hz: 100, mean: 0.01 }]),
      current: createReport(dir, [{ name: "new name", hz: 100, mean: 0.01 }]),
    });

    expect(markdown).toContain(
      "All benchmarks were renamed; no comparison possible.",
    );
  });

  test("reports removed benchmarks distinctly from unchanged results", () => {
    const dir = createTempDir();
    const markdown = runCompare({
      baseline: createReport(dir, [{ name: "removed", hz: 100, mean: 0.01 }]),
      current: createReport(dir, []),
    });

    expect(markdown).toContain(
      "Some benchmarks were removed; no comparable benchmarks remain.",
    );
  });

  test("falls back to empty results for malformed JSON", () => {
    const dir = createTempDir();
    const outputDir = path.join(dir, resultsDir);
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(path.join(outputDir, "baseline.json"), "{", "utf-8");
    writeJson(
      dir,
      "current.json",
      createReport(dir, [{ name: "current", hz: 100, mean: 0.01 }]),
    );

    execFileSync(process.execPath, [scriptPath], {
      cwd: dir,
      stdio: "pipe",
    });

    const markdown = readFileSync(
      path.join(outputDir, "comparison.md"),
      "utf-8",
    );
    expect(markdown).toContain("No baseline results available for comparison.");
  });
});
