import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const RESULTS_DIR = path.join(process.cwd(), ".perf-results");
const THRESHOLD_PERCENT = 10;

interface BenchmarkReport {
  files?: ReportFile[];
}

interface ReportFile {
  filepath?: string;
  groups?: ReportGroup[];
}

interface ReportGroup {
  fullName?: string;
  benchmarks?: ReportBenchmark[];
}

interface ReportBenchmark {
  name?: string;
  hz?: number;
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  rme?: number;
  sampleCount?: number;
}

interface BenchmarkEntry {
  key: string;
  file: string;
  group: string;
  name: string;
  hz: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  rme: number;
  sampleCount: number;
}

interface ComparisonRow {
  key: string;
  label: string;
  baseline: BenchmarkEntry;
  current: BenchmarkEntry;
  percent: number;
  significant: boolean;
}

interface ComparisonSummary {
  rows: ComparisonRow[];
  newBenchmarks: BenchmarkEntry[];
  removedBenchmarks: BenchmarkEntry[];
  hasSignificantChanges: boolean;
}

function readJsonFile(filePath: string): unknown {
  if (!existsSync(filePath)) return {};
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function getNumber(value: unknown): number {
  if (typeof value !== "number") return 0;
  if (!Number.isFinite(value)) return 0;
  return value;
}

function normalizeFilePath(filePath: string) {
  if (!filePath) return "";
  return path.relative(process.cwd(), filePath);
}

function getPackageName(filePath: string) {
  const [workspace, packageName] = filePath.split(/[\\/]/);
  if (workspace === "packages" && packageName) return packageName;
  return workspace ?? "";
}

function formatLabel(entry: BenchmarkEntry): string {
  const parts = [
    getPackageName(entry.file),
    path.basename(entry.file),
    entry.name,
  ].filter(Boolean);
  return parts.join(" > ");
}

function loadEntries(prefix: string): BenchmarkEntry[] {
  const report = readJsonFile(
    path.join(RESULTS_DIR, `${prefix}.json`),
  ) as BenchmarkReport;
  const entries: BenchmarkEntry[] = [];

  for (const file of report.files ?? []) {
    const filePath = normalizeFilePath(file.filepath ?? "");
    for (const group of file.groups ?? []) {
      const groupName = group.fullName ?? "";
      for (const benchmark of group.benchmarks ?? []) {
        const name = benchmark.name ?? "";
        const key = `${filePath}::${groupName}::${name}`;
        entries.push({
          key,
          file: filePath,
          group: groupName,
          name,
          hz: getNumber(benchmark.hz),
          mean: getNumber(benchmark.mean),
          median: getNumber(benchmark.median),
          min: getNumber(benchmark.min),
          max: getNumber(benchmark.max),
          rme: getNumber(benchmark.rme),
          sampleCount: getNumber(benchmark.sampleCount),
        });
      }
    }
  }

  return entries;
}

function compare(): ComparisonSummary {
  const baseline = loadEntries("baseline");
  const current = loadEntries("current");
  const baselineByKey = new Map<string, BenchmarkEntry>();
  const currentByKey = new Map<string, BenchmarkEntry>();

  for (const entry of baseline) {
    baselineByKey.set(entry.key, entry);
  }
  for (const entry of current) {
    currentByKey.set(entry.key, entry);
  }

  const rows: ComparisonRow[] = [];
  const newBenchmarks: BenchmarkEntry[] = [];
  const removedBenchmarks: BenchmarkEntry[] = [];

  for (const currentEntry of current) {
    const baselineEntry = baselineByKey.get(currentEntry.key);
    if (!baselineEntry) {
      newBenchmarks.push(currentEntry);
      continue;
    }
    const percent =
      baselineEntry.hz > 0
        ? ((currentEntry.hz - baselineEntry.hz) / baselineEntry.hz) * 100
        : 0;
    const significant = Math.abs(percent) > THRESHOLD_PERCENT;
    rows.push({
      key: currentEntry.key,
      label: formatLabel(currentEntry),
      baseline: baselineEntry,
      current: currentEntry,
      percent,
      significant,
    });
  }

  for (const baselineEntry of baseline) {
    if (!currentByKey.has(baselineEntry.key)) {
      removedBenchmarks.push(baselineEntry);
    }
  }

  return {
    rows,
    newBenchmarks,
    removedBenchmarks,
    hasSignificantChanges: rows.some((row) => row.significant),
  };
}

function formatHz(value: number) {
  return `${Math.round(value).toLocaleString("en-US")} ops/sec`;
}

function formatMs(value: number) {
  return `${value.toFixed(4)}ms`;
}

function formatPercent(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(0)}%`;
}

function escapeTableCell(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/[\r\n\t]/g, " ")
    .trim();
}

function formatBenchmarkRows(rows: ComparisonRow[]) {
  const lines: string[] = [];
  lines.push("| Benchmark | Baseline | Current | Change | Mean |");
  lines.push("|-----------|----------|---------|--------|------|");

  for (const row of rows) {
    let change = formatPercent(row.percent);
    if (row.significant) {
      change += row.percent < 0 ? " :warning:" : " :rocket:";
    }
    const cells = [
      escapeTableCell(row.label),
      formatHz(row.baseline.hz),
      formatHz(row.current.hz),
      change,
      formatMs(row.current.mean),
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }

  return lines;
}

function formatNewBenchmarks(entries: BenchmarkEntry[]) {
  const lines: string[] = [];
  lines.push("### New benchmarks");
  lines.push("");
  lines.push("| Benchmark | Current | Mean |");
  lines.push("|-----------|---------|------|");

  for (const entry of entries) {
    lines.push(
      `| ${escapeTableCell(formatLabel(entry))} | ${formatHz(entry.hz)} | ${formatMs(entry.mean)} |`,
    );
  }

  lines.push("");
  return lines;
}

function formatRemovedBenchmarks(entries: BenchmarkEntry[]) {
  const lines: string[] = [];
  lines.push("### Removed benchmarks");
  lines.push("");

  for (const entry of entries) {
    lines.push(`- ${escapeTableCell(formatLabel(entry))}`);
  }

  lines.push("");
  return lines;
}

function formatMarkdown(summary: ComparisonSummary) {
  const { rows, newBenchmarks, removedBenchmarks, hasSignificantChanges } =
    summary;
  const lines: string[] = [];
  const significantRows = rows.filter((row) => row.significant);
  const totalBenchmarks =
    rows.length + newBenchmarks.length + removedBenchmarks.length;

  lines.push("## Performance");
  lines.push("");

  if (hasSignificantChanges) {
    lines.push(...formatBenchmarkRows(significantRows));
  } else if (rows.length === 0 && newBenchmarks.length > 0) {
    lines.push("No baseline results available for comparison.");
  } else if (totalBenchmarks === 0) {
    lines.push("No performance results found.");
  } else {
    lines.push("No significant performance changes detected.");
  }

  lines.push("");
  lines.push("<details>");
  lines.push(
    `<summary>Full breakdown (${totalBenchmarks} benchmarks)</summary>`,
  );
  lines.push("");

  if (rows.length > 0) {
    lines.push(...formatBenchmarkRows(rows));
    lines.push("");
  }
  if (newBenchmarks.length > 0) {
    lines.push(...formatNewBenchmarks(newBenchmarks));
  }
  if (removedBenchmarks.length > 0) {
    lines.push(...formatRemovedBenchmarks(removedBenchmarks));
  }

  lines.push("</details>");
  lines.push("");
  lines.push(
    `:warning: = regression above ${THRESHOLD_PERCENT}% - :rocket: = improvement above ${THRESHOLD_PERCENT}%`,
  );

  return lines.join("\n");
}

const summary = compare();
const markdown = formatMarkdown(summary);

mkdirSync(RESULTS_DIR, { recursive: true });
writeFileSync(
  path.join(RESULTS_DIR, "comparison.json"),
  JSON.stringify(summary, null, 2),
);
writeFileSync(path.join(RESULTS_DIR, "comparison.md"), markdown);

console.log(markdown);
