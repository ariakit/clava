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
const scriptPath = path.join(import.meta.dirname, "index.ts");
const tempDirs: string[] = [];

interface Benchmark {
  name: string;
  hz?: number;
  mean?: number;
}

interface ComparisonSummary {
  hasSignificantChanges: boolean;
  hasConfirmableChanges: boolean;
  pairedRoundsCount: number;
  bundleSize?: {
    rows: Array<{
      label: string;
      baseline: number;
      current: number;
      delta: number;
      percent: number;
    }>;
  };
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
        filepath: path.join(dir, "benchmark/clava.bench.ts"),
        groups: [
          {
            fullName: "benchmark/clava.bench.ts > cv",
            benchmarks,
          },
        ],
      },
    ],
  };
}

function createSplitRootReport(root: string, hz: number) {
  return {
    files: [
      {
        filepath: path.join(root, "benchmark/clava.bench.ts"),
        groups: [
          {
            fullName: "benchmark/clava.bench.ts > cv",
            benchmarks: [{ name: "split-roots bench", hz, mean: 1 / hz }],
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
  bundleSizeBaseline,
  bundleSizeCurrent,
}: {
  baseline?: unknown;
  current?: unknown;
  bundleSizeBaseline?: unknown;
  bundleSizeCurrent?: unknown;
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
  if (bundleSizeBaseline) {
    writeJson(dir, "bundle-size-baseline.json", bundleSizeBaseline);
  }
  if (bundleSizeCurrent) {
    writeJson(dir, "bundle-size-current.json", bundleSizeCurrent);
  }

  execFileSync(process.execPath, [scriptPath, "perf-compare"], {
    cwd: dir,
    stdio: "pipe",
  });

  return readFileSync(path.join(outputDir, "comparison.md"), "utf-8");
}

function runCompareRoundsResult({
  baseline,
  current,
  bundleSizeBaseline,
  bundleSizeCurrent,
}: {
  baseline: unknown[];
  current: unknown[];
  bundleSizeBaseline?: unknown;
  bundleSizeCurrent?: unknown;
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
  if (bundleSizeBaseline) {
    writeJson(dir, "bundle-size-baseline.json", bundleSizeBaseline);
  }
  if (bundleSizeCurrent) {
    writeJson(dir, "bundle-size-current.json", bundleSizeCurrent);
  }

  execFileSync(process.execPath, [scriptPath, "perf-compare"], {
    cwd: dir,
    stdio: "pipe",
  });

  return {
    markdown: readFileSync(path.join(outputDir, "comparison.md"), "utf-8"),
    summary: JSON.parse(
      readFileSync(path.join(outputDir, "comparison.json"), "utf-8"),
    ) as ComparisonSummary,
  };
}

function runCompareRounds(args: { baseline: unknown[]; current: unknown[] }) {
  return runCompareRoundsResult(args).markdown;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("perf compare", () => {
  test("renders bundle size comparison", () => {
    const markdown = runCompare({
      bundleSizeBaseline: { minifiedBytes: 1000, gzipBytes: 500 },
      bundleSizeCurrent: { minifiedBytes: 1100, gzipBytes: 450 },
    });

    expect(markdown).toContain("## Bundle Size");
    expect(markdown).toContain("| Metric | Baseline | Current | Change |");
    expect(markdown).toContain(
      "| Minified | 1.00 kB | 1.10 kB | +0.10 kB (+10.0%) :warning: |",
    );
    expect(markdown).toContain(
      "| Minified + gzip | 0.50 kB | 0.45 kB | -0.05 kB (-10.0%) :rocket: |",
    );
  });

  test("writes bundle size comparison to summary JSON", () => {
    const { summary } = runCompareRoundsResult({
      baseline: [],
      current: [],
      bundleSizeBaseline: { minifiedBytes: 1000, gzipBytes: 500 },
      bundleSizeCurrent: { minifiedBytes: 1100, gzipBytes: 450 },
    });

    expect(summary.bundleSize?.rows).toEqual([
      {
        label: "Minified",
        baseline: 1000,
        current: 1100,
        delta: 100,
        percent: 10,
      },
      {
        label: "Minified + gzip",
        baseline: 500,
        current: 450,
        delta: -50,
        percent: -10,
      },
    ]);
  });

  test("omits bundle size comparison when size results are absent", () => {
    const dir = createTempDir();
    const markdown = runCompare({
      current: createReport(dir, [{ name: "current", hz: 100, mean: 0.01 }]),
    });

    expect(markdown).not.toContain("## Bundle Size");
    expect(markdown).toContain("No baseline results available for comparison.");
  });

  test("allows unused arguments", () => {
    const dir = createTempDir();
    const outputDir = path.join(dir, resultsDir);
    mkdirSync(outputDir, { recursive: true });

    execFileSync(
      process.execPath,
      [scriptPath, "perf-compare", "--ignored", "extra"],
      {
        cwd: dir,
        stdio: "pipe",
      },
    );

    const markdown = readFileSync(
      path.join(outputDir, "comparison.md"),
      "utf-8",
    );
    expect(markdown).toContain("No performance results found.");
  });

  test("omits bundle size comparison when size results are partial", () => {
    const markdown = runCompare({
      bundleSizeBaseline: { minifiedBytes: 1000, gzipBytes: 500 },
      bundleSizeCurrent: { minifiedBytes: 1100 },
    });

    expect(markdown).not.toContain("## Bundle Size");
    expect(markdown).toContain("No performance results found.");
  });

  test("omits bundle size comparison when size JSON is malformed", () => {
    const dir = createTempDir();
    const outputDir = path.join(dir, resultsDir);
    mkdirSync(outputDir, { recursive: true });
    writeJson(dir, "bundle-size-baseline.json", {
      minifiedBytes: 1000,
      gzipBytes: 500,
    });
    writeFileSync(path.join(outputDir, "bundle-size-current.json"), "{");

    execFileSync(process.execPath, [scriptPath, "perf-compare"], {
      cwd: dir,
      stdio: "pipe",
    });

    const markdown = readFileSync(
      path.join(outputDir, "comparison.md"),
      "utf-8",
    );
    expect(markdown).not.toContain("## Bundle Size");
    expect(markdown).toContain("No performance results found.");
  });

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

    execFileSync(process.execPath, [scriptPath, "perf-compare"], {
      cwd: dir,
      stdio: "pipe",
    });

    const markdown = readFileSync(
      path.join(outputDir, "comparison.md"),
      "utf-8",
    );

    expect(markdown).toContain(
      "benchmark > clava.bench.ts > create component with variants",
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

    writeJson(
      dir,
      "baseline.json",
      createSplitRootReport("/runner-temp/perf-baseline", 100),
    );
    writeJson(dir, "current.json", createSplitRootReport(dir, 80));

    execFileSync(process.execPath, [scriptPath, "perf-compare"], {
      cwd: dir,
      stdio: "pipe",
    });

    const markdown = readFileSync(
      path.join(outputDir, "comparison.md"),
      "utf-8",
    );

    expect(markdown).toContain(
      "benchmark > clava.bench.ts > split-roots bench",
    );
    expect(markdown).not.toContain("All benchmarks were renamed");
    expect(markdown).toContain("-20% :warning:");
  });

  test("pairs versioned benchmark names with unversioned baselines", () => {
    const dir = createTempDir();
    const markdown = runCompare({
      baseline: createReport(dir, [
        { name: "clava", hz: 100, mean: 1 / 100 },
        { name: "cva", hz: 100, mean: 1 / 100 },
      ]),
      current: createReport(dir, [
        { name: "clava@0.2.3", hz: 80, mean: 1 / 80 },
        { name: "cva@1.0.0-beta.4", hz: 120, mean: 1 / 120 },
        { name: "tailwind-variants@3.2.2", hz: 100, mean: 1 / 100 },
      ]),
    });

    expect(markdown).toContain("benchmark > clava.bench.ts > clava@0.2.3");
    expect(markdown).toContain("benchmark > clava.bench.ts > cva@1.0.0-beta.4");
    expect(markdown).toContain("-20% :warning:");
    expect(markdown).toContain("+20% :rocket:");
    expect(markdown).toContain("### New benchmarks");
    expect(markdown).toContain(
      "benchmark > clava.bench.ts > tailwind-variants@3.2.2",
    );
    expect(markdown).not.toContain("All benchmarks were renamed");
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

  test("does not flag when only direction agrees across rounds", () => {
    const dir = createTempDir();
    const baselineRounds = [100, 100, 100].map((hz) =>
      createReport(dir, [{ name: "direction-only bench", hz, mean: 1 / hz }]),
    );
    const currentRounds = [102, 134, 132].map((hz) =>
      createReport(dir, [{ name: "direction-only bench", hz, mean: 1 / hz }]),
    );

    const { markdown, summary } = runCompareRoundsResult({
      baseline: baselineRounds,
      current: currentRounds,
    });

    expect(summary.hasSignificantChanges).toBe(false);
    expect(summary.hasConfirmableChanges).toBe(false);
    expect(markdown).toContain("No significant performance changes detected.");
    expect(markdown).not.toMatch(/% :rocket:/);
  });

  test("does not flag when only direction agrees across five rounds", () => {
    const dir = createTempDir();
    const baselineRounds = [100, 100, 100, 100, 100].map((hz) =>
      createReport(dir, [
        { name: "five-round direction-only", hz, mean: 1 / hz },
      ]),
    );
    // Median +30%, but only three rounds clear the threshold in the same
    // direction. Old direction-only agreement would have flagged this.
    const currentRounds = [132, 134, 130, 102, 102].map((hz) =>
      createReport(dir, [
        { name: "five-round direction-only", hz, mean: 1 / hz },
      ]),
    );

    const { markdown, summary } = runCompareRoundsResult({
      baseline: baselineRounds,
      current: currentRounds,
    });

    expect(summary.hasSignificantChanges).toBe(false);
    expect(markdown).toContain("No significant performance changes detected.");
    expect(markdown).not.toMatch(/% :rocket:/);
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

  test("marks two-round threshold changes as preliminary", () => {
    const dir = createTempDir();
    const baselineRounds = [100, 100].map((hz) =>
      createReport(dir, [{ name: "preliminary bench", hz, mean: 1 / hz }]),
    );
    const currentRounds = [70, 72].map((hz) =>
      createReport(dir, [{ name: "preliminary bench", hz, mean: 1 / hz }]),
    );

    const { markdown, summary } = runCompareRoundsResult({
      baseline: baselineRounds,
      current: currentRounds,
    });

    expect(summary.hasSignificantChanges).toBe(true);
    expect(summary.hasConfirmableChanges).toBe(false);
    expect(summary.pairedRoundsCount).toBe(2);
    expect(markdown).toContain(
      "Aggregated across 2 interleaved rounds (preliminary).",
    );
  });

  test("does not confirm split two-round changes", () => {
    const dir = createTempDir();
    const baselineRounds = [100, 100].map((hz) =>
      createReport(dir, [
        { name: "split preliminary bench", hz, mean: 1 / hz },
      ]),
    );
    const currentRounds = [70, 105].map((hz) =>
      createReport(dir, [
        { name: "split preliminary bench", hz, mean: 1 / hz },
      ]),
    );

    const { markdown, summary } = runCompareRoundsResult({
      baseline: baselineRounds,
      current: currentRounds,
    });

    expect(summary.hasSignificantChanges).toBe(false);
    expect(summary.hasConfirmableChanges).toBe(false);
    expect(summary.pairedRoundsCount).toBe(2);
    expect(markdown).toContain("No significant performance changes detected.");
  });

  test("confirms near-threshold unanimous two-round changes", () => {
    const dir = createTempDir();
    const baselineRounds = [100, 100].map((hz) =>
      createReport(dir, [{ name: "borderline bench", hz, mean: 1 / hz }]),
    );
    const currentRounds = [89, 91].map((hz) =>
      createReport(dir, [{ name: "borderline bench", hz, mean: 1 / hz }]),
    );

    const { markdown, summary } = runCompareRoundsResult({
      baseline: baselineRounds,
      current: currentRounds,
    });

    expect(summary.hasSignificantChanges).toBe(false);
    expect(summary.hasConfirmableChanges).toBe(true);
    expect(summary.pairedRoundsCount).toBe(2);
    expect(markdown).toContain("No significant performance changes detected.");
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

    execFileSync(process.execPath, [scriptPath, "perf-compare"], {
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
