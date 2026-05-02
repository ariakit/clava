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
        filepath: path.join(dir, "benchmark/component.bench.ts"),
        groups: [
          {
            fullName: "benchmark/component.bench.ts > cv",
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

function runCompareRounds({
  baseline,
  current,
}: {
  baseline: unknown[];
  current: unknown[];
}) {
  const dir = createTempDir();
  const outputDir = path.join(dir, resultsDir);
  mkdirSync(outputDir, { recursive: true });
  baseline.forEach((report, index) => {
    writeJson(dir, `baseline-${index + 1}.json`, report);
  });
  current.forEach((report, index) => {
    writeJson(dir, `current-${index + 1}.json`, report);
  });

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
      "benchmark > component.bench.ts > create component with variants",
    );
    expect(markdown).not.toContain("benchmark/");
  });

  test("pairs benchmarks when baseline and current report different absolute roots", () => {
    // In CI, the baseline tree lives under $BASELINE_DIR (e.g. $RUNNER_TEMP)
    // while the current tree lives under $GITHUB_WORKSPACE. Vitest reports
    // absolute filepaths, so without anchoring to the workspace root the two
    // sides would key under different paths and every benchmark would land in
    // new/removed instead of pairing for comparison.
    const dir = createTempDir();
    const outputDir = path.join(dir, resultsDir);
    mkdirSync(outputDir, { recursive: true });

    const reportFor = (root: string, hz: number) => ({
      files: [
        {
          filepath: path.join(root, "benchmark/component.bench.ts"),
          groups: [
            {
              fullName: "benchmark/component.bench.ts > cv",
              benchmarks: [{ name: "split-roots bench", hz, mean: 1 / hz }],
            },
          ],
        },
      ],
    });

    writeJson(
      dir,
      "baseline.json",
      reportFor("/runner-temp/perf-baseline", 100),
    );
    writeJson(dir, "current.json", reportFor(dir, 80));

    execFileSync(process.execPath, [scriptPath], {
      cwd: dir,
      stdio: "pipe",
    });

    const markdown = readFileSync(
      path.join(outputDir, "comparison.md"),
      "utf-8",
    );

    expect(markdown).toContain(
      "benchmark > component.bench.ts > split-roots bench",
    );
    expect(markdown).not.toContain("All benchmarks were renamed");
    expect(markdown).toContain("-20% :warning:");
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

  test("does not flag a regression when rounds disagree on direction", () => {
    const dir = createTempDir();
    const baselineRounds = [100, 100, 100, 100, 100].map((hz) =>
      createReport(dir, [{ name: "noisy bench", hz, mean: 1 / hz }]),
    );
    // Five rounds with three improvements and two large regressions: median is
    // a regression but rounds do not agree, so this must not be flagged.
    const currentRounds = [110, 115, 105, 70, 75].map((hz) =>
      createReport(dir, [{ name: "noisy bench", hz, mean: 1 / hz }]),
    );

    const markdown = runCompareRounds({
      baseline: baselineRounds,
      current: currentRounds,
    });

    expect(markdown).toContain("No significant performance changes detected.");
    expect(markdown).not.toMatch(/% :warning:/);
    expect(markdown).toContain("Aggregated across 5 interleaved rounds");
  });

  test("flags a consistent regression across rounds", () => {
    const dir = createTempDir();
    const baselineRounds = [100, 102, 99, 101, 100].map((hz) =>
      createReport(dir, [{ name: "consistent bench", hz, mean: 1 / hz }]),
    );
    const currentRounds = [80, 78, 82, 79, 81].map((hz) =>
      createReport(dir, [{ name: "consistent bench", hz, mean: 1 / hz }]),
    );

    const markdown = runCompareRounds({
      baseline: baselineRounds,
      current: currentRounds,
    });

    expect(markdown).toContain(":warning:");
    expect(markdown).toMatch(/-2\d% :warning:/);
  });

  test("tolerates a single dissenting round when there are 5", () => {
    const dir = createTempDir();
    const baselineRounds = [100, 100, 100, 100, 100].map((hz) =>
      createReport(dir, [{ name: "robust bench", hz, mean: 1 / hz }]),
    );
    // 4 of 5 rounds show a regression; 1 round shows a tiny noise gain.
    const currentRounds = [70, 72, 105, 68, 74].map((hz) =>
      createReport(dir, [{ name: "robust bench", hz, mean: 1 / hz }]),
    );

    const markdown = runCompareRounds({
      baseline: baselineRounds,
      current: currentRounds,
    });

    expect(markdown).toContain(":warning:");
  });

  test("does not flag with two dissenters at five rounds", () => {
    const dir = createTempDir();
    const baselineRounds = [100, 100, 100, 100, 100].map((hz) =>
      createReport(dir, [{ name: "two-dissent bench", hz, mean: 1 / hz }]),
    );
    // 3 of 5 regress, 2 disagree — beyond the single-dissenter tolerance.
    const currentRounds = [70, 72, 74, 105, 108].map((hz) =>
      createReport(dir, [{ name: "two-dissent bench", hz, mean: 1 / hz }]),
    );

    const markdown = runCompareRounds({
      baseline: baselineRounds,
      current: currentRounds,
    });

    expect(markdown).toContain("No significant performance changes detected.");
    expect(markdown).not.toMatch(/% :warning:/);
  });

  test("flags an unanimous regression with four rounds", () => {
    const dir = createTempDir();
    const baselineRounds = [100, 100, 100, 100].map((hz) =>
      createReport(dir, [{ name: "four-round bench", hz, mean: 1 / hz }]),
    );
    const currentRounds = [78, 80, 82, 79].map((hz) =>
      createReport(dir, [{ name: "four-round bench", hz, mean: 1 / hz }]),
    );

    const markdown = runCompareRounds({
      baseline: baselineRounds,
      current: currentRounds,
    });

    expect(markdown).toMatch(/-2\d% :warning:/);
  });

  test("requires unanimity with four rounds", () => {
    const dir = createTempDir();
    const baselineRounds = [100, 100, 100, 100].map((hz) =>
      createReport(dir, [{ name: "four-round dissent", hz, mean: 1 / hz }]),
    );
    // 3 of 4 regress; with N=4 we still require unanimity, so this is noise.
    const currentRounds = [70, 72, 74, 105].map((hz) =>
      createReport(dir, [{ name: "four-round dissent", hz, mean: 1 / hz }]),
    );

    const markdown = runCompareRounds({
      baseline: baselineRounds,
      current: currentRounds,
    });

    expect(markdown).toContain("No significant performance changes detected.");
    expect(markdown).not.toMatch(/% :warning:/);
  });

  test("aggregates displayed values from shared rounds when round counts differ", () => {
    const dir = createTempDir();
    // Baseline ran four rounds for this bench; current only ran two. The
    // unpaired baseline rounds (3-4) are much faster and would drag the
    // independent baseline median above the paired rounds, flipping the
    // sign of the percent change. Aggregating from shared rounds only keeps
    // the comparison honest.
    const baselineRounds = [50, 50, 200, 200].map((hz) =>
      createReport(dir, [{ name: "asymmetric bench", hz, mean: 1 / hz }]),
    );
    const currentRounds = [60, 60].map((hz) =>
      createReport(dir, [{ name: "asymmetric bench", hz, mean: 1 / hz }]),
    );

    const markdown = runCompareRounds({
      baseline: baselineRounds,
      current: currentRounds,
    });

    expect(markdown).toContain("+20% :rocket:");
    expect(markdown).toContain("50 ops/sec");
    expect(markdown).toContain("60 ops/sec");
    expect(markdown).not.toMatch(/% :warning:/);
  });

  test("aligns per-round comparison when a benchmark is missing from a round", () => {
    const dir = createTempDir();
    // Three baseline rounds; bench "b" is missing from baseline round 2 only.
    const baselineRounds = [
      createReport(dir, [
        { name: "a", hz: 100, mean: 1 / 100 },
        { name: "b", hz: 200, mean: 1 / 200 },
      ]),
      createReport(dir, [{ name: "a", hz: 100, mean: 1 / 100 }]),
      createReport(dir, [
        { name: "a", hz: 100, mean: 1 / 100 },
        { name: "b", hz: 200, mean: 1 / 200 },
      ]),
    ];
    // Three current rounds; bench "b" present everywhere.
    // Per-round baseline values for "b" exist in rounds 1 and 3.
    const currentRounds = [
      createReport(dir, [
        { name: "a", hz: 100, mean: 1 / 100 },
        { name: "b", hz: 140, mean: 1 / 140 },
      ]),
      createReport(dir, [
        { name: "a", hz: 100, mean: 1 / 100 },
        { name: "b", hz: 145, mean: 1 / 145 },
      ]),
      createReport(dir, [
        { name: "a", hz: 100, mean: 1 / 100 },
        { name: "b", hz: 142, mean: 1 / 142 },
      ]),
    ];

    const markdown = runCompareRounds({
      baseline: baselineRounds,
      current: currentRounds,
    });

    // Bench "b" went from 200 to ~141 in every paired round (rounds 1 and 3),
    // so the change must be flagged as a regression. Current's round-2 value
    // (145) is excluded because baseline never produced one to pair with.
    expect(markdown).toMatch(/-30% :warning:/);
  });

  test("requires unanimity with three rounds", () => {
    const dir = createTempDir();
    const baselineRounds = [100, 100, 100].map((hz) =>
      createReport(dir, [{ name: "small-n bench", hz, mean: 1 / hz }]),
    );
    // 2 of 3 regress, but with only three rounds we require unanimity.
    const currentRounds = [70, 72, 105].map((hz) =>
      createReport(dir, [{ name: "small-n bench", hz, mean: 1 / hz }]),
    );

    const markdown = runCompareRounds({
      baseline: baselineRounds,
      current: currentRounds,
    });

    expect(markdown).toContain("No significant performance changes detected.");
    expect(markdown).not.toMatch(/% :warning:/);
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
