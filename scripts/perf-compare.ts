import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
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
}

interface BenchmarkEntry {
  key: string;
  file: string;
  group: string;
  name: string;
  hz: number;
  mean: number;
}

interface RoundEntry {
  roundIndex: number;
  entry: BenchmarkEntry;
}

interface AggregatedBenchmark {
  key: string;
  file: string;
  group: string;
  name: string;
  // Indexed by roundIndex so we can pair baseline and current entries from the
  // same round even when one tree is missing a benchmark in some rounds.
  byRound: Map<number, BenchmarkEntry>;
  hz: number;
  mean: number;
}

interface ComparisonRow {
  key: string;
  label: string;
  baseline: AggregatedBenchmark;
  current: AggregatedBenchmark;
  percent: number;
  perRoundPercents: number[];
  agreement: number;
  significant: boolean;
}

interface ComparisonSummary {
  rows: ComparisonRow[];
  newBenchmarks: AggregatedBenchmark[];
  removedBenchmarks: AggregatedBenchmark[];
  bundleSize?: BundleSizeComparison;
  hasSignificantChanges: boolean;
  // Preliminary comparisons use this to decide whether one more round could
  // turn a near-threshold, same-direction result into a final significant row.
  hasConfirmableChanges: boolean;
  // Number of rounds where both baseline and current produced data (i.e. the
  // count actually used for comparison), not the larger of the two raw counts.
  pairedRoundsCount: number;
}

interface BundleSizeReport {
  minifiedBytes: number;
  gzipBytes: number;
}

interface BundleSizeRow {
  label: string;
  baseline: number;
  current: number;
  delta: number;
  percent: number;
}

interface BundleSizeComparison {
  rows: BundleSizeRow[];
}

function createBundleSizeRow(
  label: string,
  baselineBytes: number,
  currentBytes: number,
): BundleSizeRow {
  const delta = currentBytes - baselineBytes;
  return {
    label,
    baseline: baselineBytes,
    current: currentBytes,
    delta,
    percent: baselineBytes > 0 ? (delta / baselineBytes) * 100 : 0,
  };
}

function readJsonFile(filePath: string): unknown {
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (error) {
    console.warn(
      `Warning: failed to parse JSON file at ${filePath}. Falling back to empty results.`,
      error,
    );
    return {};
  }
}

function readOptionalJsonFile(filePath: string): unknown {
  if (!existsSync(filePath)) return undefined;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (error) {
    console.warn(
      `Warning: failed to parse JSON file at ${filePath}. Skipping bundle-size comparison.`,
      error,
    );
    return undefined;
  }
}

function getNumber(value: unknown): number {
  if (typeof value !== "number") return 0;
  if (!Number.isFinite(value)) return 0;
  return value;
}

function loadBundleSizeReport(name: string): BundleSizeReport | undefined {
  const filePath = path.join(RESULTS_DIR, name);
  const report = readOptionalJsonFile(filePath);
  if (!report) return undefined;
  if (typeof report !== "object") return undefined;
  const { minifiedBytes, gzipBytes } = report as Partial<BundleSizeReport>;
  const minified = getNumber(minifiedBytes);
  const gzip = getNumber(gzipBytes);
  if (minified <= 0 || gzip <= 0) {
    console.warn(
      `Warning: invalid bundle size report at ${filePath}. Skipping bundle-size comparison.`,
    );
    return undefined;
  }
  return {
    minifiedBytes: minified,
    gzipBytes: gzip,
  };
}

function compareBundleSize(): BundleSizeComparison | undefined {
  const baseline = loadBundleSizeReport("bundle-size-baseline.json");
  const current = loadBundleSizeReport("bundle-size-current.json");
  if (!baseline) return undefined;
  if (!current) return undefined;

  return {
    rows: [
      createBundleSizeRow(
        "Minified",
        baseline.minifiedBytes,
        current.minifiedBytes,
      ),
      createBundleSizeRow(
        "Minified + gzip",
        baseline.gzipBytes,
        current.gzipBytes,
      ),
    ],
  };
}

function normalizeFilePath(filePath: string) {
  if (!filePath) return "";
  // Baseline benches run inside a detached worktree under $BASELINE_DIR, so
  // vitest's absolute filepath values differ from the current side's paths
  // even when they refer to the same file. Anchor to the first known
  // workspace root so both sides produce the same key regardless of where
  // vitest was invoked from. Fall back to a cwd-relative path when no known
  // root is present so paths outside a workspace still resolve sensibly.
  const rooted = filePath.match(
    /(?:^|[\\/])((?:packages|app|benchmark)[\\/].+)$/,
  );
  if (rooted?.[1]) return rooted[1];
  return path.relative(process.cwd(), filePath);
}

function normalizeBenchmarkName(name: string) {
  return name.replace(/@\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, "");
}

function getPackageName(filePath: string) {
  const [workspace, packageName] = filePath.split(/[\\/]/);
  if (workspace === "packages" && packageName) return packageName;
  return workspace ?? "";
}

function formatLabel({ file, name }: { file: string; name: string }): string {
  const parts = [getPackageName(file), path.basename(file), name].filter(
    Boolean,
  );
  return parts.join(" > ");
}

function entriesFromReport(report: BenchmarkReport): BenchmarkEntry[] {
  const entries: BenchmarkEntry[] = [];
  for (const file of report.files ?? []) {
    const filePath = normalizeFilePath(file.filepath ?? "");
    for (const group of file.groups ?? []) {
      const groupName = group.fullName ?? "";
      for (const benchmark of group.benchmarks ?? []) {
        const name = benchmark.name ?? "";
        const key = `${filePath}::${groupName}::${normalizeBenchmarkName(name)}`;
        entries.push({
          key,
          file: filePath,
          group: groupName,
          name,
          hz: getNumber(benchmark.hz),
          mean: getNumber(benchmark.mean),
        });
      }
    }
  }
  return entries;
}

interface DiscoveredRoundFile {
  filePath: string;
  roundIndex: number;
}

// Discover round files like `baseline-1.json`, `baseline-2.json`, ... and
// expose each one's round number so per-round comparisons stay aligned across
// baseline and current even if a round is missing on one side. Falls back to
// single-round `baseline.json` (assigned roundIndex 1) so existing single-run
// setups keep working.
function discoverRoundFiles(prefix: string): DiscoveredRoundFile[] {
  if (!existsSync(RESULTS_DIR)) return [];
  const numbered: DiscoveredRoundFile[] = [];
  for (const name of readdirSync(RESULTS_DIR)) {
    const match = name.match(/^(.+)-(\d+)\.json$/);
    if (!match) continue;
    if (match[1] !== prefix) continue;
    numbered.push({
      filePath: path.join(RESULTS_DIR, name),
      roundIndex: Number(match[2] ?? 0),
    });
  }
  if (numbered.length > 0) {
    return numbered.toSorted((a, b) => a.roundIndex - b.roundIndex);
  }

  const fallback = path.join(RESULTS_DIR, `${prefix}.json`);
  if (existsSync(fallback)) return [{ filePath: fallback, roundIndex: 1 }];
  return [];
}

function loadRounds(prefix: string): RoundEntry[] {
  const discovered = discoverRoundFiles(prefix);
  const out: RoundEntry[] = [];
  for (const { filePath, roundIndex } of discovered) {
    const report = readJsonFile(filePath) as BenchmarkReport;
    for (const entry of entriesFromReport(report)) {
      out.push({ roundIndex, entry });
    }
  }
  return out;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  const left = sorted[middle - 1] ?? 0;
  const right = sorted[middle] ?? 0;
  return (left + right) / 2;
}

function aggregateByKey(
  roundEntries: RoundEntry[],
): Map<string, AggregatedBenchmark> {
  const grouped = new Map<string, Map<number, BenchmarkEntry>>();
  for (const { roundIndex, entry } of roundEntries) {
    let inner = grouped.get(entry.key);
    if (!inner) {
      inner = new Map();
      grouped.set(entry.key, inner);
    }
    inner.set(roundIndex, entry);
  }

  const aggregated = new Map<string, AggregatedBenchmark>();
  for (const [key, byRound] of grouped) {
    const entries = [...byRound.values()];
    const first = entries[0];
    if (!first) continue;
    const medianHz = median(entries.map((entry) => entry.hz));
    // Derive the displayed mean from the same median hz so the two cells in a
    // row never come from different rounds.
    const meanFromMedianHz = medianHz > 0 ? 1000 / medianHz : 0;
    aggregated.set(key, {
      key,
      file: first.file,
      group: first.group,
      name: first.name,
      byRound,
      hz: medianHz,
      mean: meanFromMedianHz,
    });
  }
  return aggregated;
}

// Direction-of-change agreement check across rounds. Up to four rounds require
// unanimity. Five or more rounds tolerate a single dissenter so a one-off CI
// hiccup cannot block an alert.
function requiredAgreement(roundsCount: number) {
  if (roundsCount <= 1) return 1;
  if (roundsCount <= 4) return roundsCount;
  return roundsCount - 1;
}

function computeSignificance({
  medianPercent,
  perRoundPercents,
}: {
  medianPercent: number;
  perRoundPercents: number[];
}): { agreement: number; significant: boolean } {
  if (perRoundPercents.length === 0) {
    return { agreement: 0, significant: false };
  }
  const direction = Math.sign(medianPercent);
  let agreement = 0;
  for (const percent of perRoundPercents) {
    if (Math.sign(percent) === direction) agreement += 1;
  }
  const magnitudeOk = Math.abs(medianPercent) > THRESHOLD_PERCENT;
  const agreementOk = agreement >= requiredAgreement(perRoundPercents.length);
  return { agreement, significant: magnitudeOk && agreementOk };
}

function isConfirmableChange(row: ComparisonRow) {
  if (row.significant) return false;
  if (row.perRoundPercents.length <= 1) return false;
  if (row.agreement !== row.perRoundPercents.length) return false;

  const direction = Math.sign(row.percent);
  if (direction === 0) return false;

  return row.perRoundPercents.some((percent) => {
    if (Math.sign(percent) !== direction) return false;
    return Math.abs(percent) > THRESHOLD_PERCENT;
  });
}

function compare(): ComparisonSummary {
  const baseline = aggregateByKey(loadRounds("baseline"));
  const current = aggregateByKey(loadRounds("current"));
  const bundleSize = compareBundleSize();

  const rows: ComparisonRow[] = [];
  const newBenchmarks: AggregatedBenchmark[] = [];
  const removedBenchmarks: AggregatedBenchmark[] = [];
  const pairedRoundIndices = new Set<number>();

  for (const [key, currentEntry] of current) {
    const baselineEntry = baseline.get(key);
    if (!baselineEntry) {
      newBenchmarks.push(currentEntry);
      continue;
    }

    const sharedRounds: number[] = [];
    for (const roundIndex of currentEntry.byRound.keys()) {
      if (baselineEntry.byRound.has(roundIndex)) sharedRounds.push(roundIndex);
    }
    sharedRounds.sort((a, b) => a - b);

    const baselineHzShared: number[] = [];
    const currentHzShared: number[] = [];
    const perRoundPercents: number[] = [];
    for (const roundIndex of sharedRounds) {
      const baselineRound = baselineEntry.byRound.get(roundIndex);
      const currentRound = currentEntry.byRound.get(roundIndex);
      if (!baselineRound) continue;
      if (!currentRound) continue;
      pairedRoundIndices.add(roundIndex);
      baselineHzShared.push(baselineRound.hz);
      currentHzShared.push(currentRound.hz);
      if (baselineRound.hz <= 0) continue;
      perRoundPercents.push(
        ((currentRound.hz - baselineRound.hz) / baselineRound.hz) * 100,
      );
    }

    // Aggregate displayed baseline/current and the percent change from the
    // shared rounds only. Using each side's independent round-median lets
    // unpaired rounds skew the comparison and can even flip the sign of the
    // change relative to perRoundPercents when one side has more rounds for
    // this benchmark than the other.
    const baselineHzMedian = median(baselineHzShared);
    const currentHzMedian = median(currentHzShared);
    const baselineDisplay: AggregatedBenchmark = {
      ...baselineEntry,
      hz: baselineHzMedian,
      mean: baselineHzMedian > 0 ? 1000 / baselineHzMedian : 0,
    };
    const currentDisplay: AggregatedBenchmark = {
      ...currentEntry,
      hz: currentHzMedian,
      mean: currentHzMedian > 0 ? 1000 / currentHzMedian : 0,
    };
    const percent =
      baselineHzMedian > 0
        ? ((currentHzMedian - baselineHzMedian) / baselineHzMedian) * 100
        : 0;

    const { agreement, significant } = computeSignificance({
      medianPercent: percent,
      perRoundPercents,
    });

    rows.push({
      key,
      label: formatLabel(currentEntry),
      baseline: baselineDisplay,
      current: currentDisplay,
      percent,
      perRoundPercents,
      agreement,
      significant,
    });
  }

  for (const [key, baselineEntry] of baseline) {
    if (!current.has(key)) {
      removedBenchmarks.push(baselineEntry);
    }
  }

  return {
    rows,
    newBenchmarks,
    removedBenchmarks,
    bundleSize,
    hasSignificantChanges: rows.some((row) => row.significant),
    hasConfirmableChanges: rows.some(isConfirmableChange),
    pairedRoundsCount: pairedRoundIndices.size,
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

function formatKilobytes(value: number) {
  return `${(value / 1000).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} kB`;
}

function formatBundleSizeChange(row: BundleSizeRow) {
  const sign = row.delta > 0 ? "+" : "";
  const percentSign = row.percent > 0 ? "+" : "";
  let change = `${sign}${formatKilobytes(row.delta)} (${percentSign}${row.percent.toFixed(1)}%)`;
  if (row.delta > 0) {
    change += " :warning:";
  } else if (row.delta < 0) {
    change += " :rocket:";
  }
  return change;
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

function formatBundleSizeRows(comparison: BundleSizeComparison) {
  const lines: string[] = [];
  lines.push("| Metric | Baseline | Current | Change |");
  lines.push("|--------|----------|---------|--------|");

  for (const row of comparison.rows) {
    const cells = [
      escapeTableCell(row.label),
      formatKilobytes(row.baseline),
      formatKilobytes(row.current),
      formatBundleSizeChange(row),
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }

  return lines;
}

function formatNewBenchmarks(entries: AggregatedBenchmark[]) {
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

function formatRemovedBenchmarks(entries: AggregatedBenchmark[]) {
  const lines: string[] = [];
  lines.push("### Removed benchmarks");
  lines.push("");

  for (const entry of entries) {
    lines.push(`- ${escapeTableCell(formatLabel(entry))}`);
  }

  lines.push("");
  return lines;
}

function formatRoundsSummary(pairedRoundsCount: number) {
  if (pairedRoundsCount <= 2) {
    return `Aggregated across ${pairedRoundsCount} interleaved rounds (preliminary).`;
  }
  return `Aggregated across ${pairedRoundsCount} interleaved rounds; a change is flagged only when the median exceeds the threshold and rounds agree on direction.`;
}

function formatMarkdown(summary: ComparisonSummary) {
  const {
    rows,
    newBenchmarks,
    removedBenchmarks,
    hasSignificantChanges,
    pairedRoundsCount,
    bundleSize,
  } = summary;
  const lines: string[] = [];
  const significantRows = rows.filter((row) => row.significant);
  const totalBenchmarks =
    rows.length + newBenchmarks.length + removedBenchmarks.length;

  if (bundleSize) {
    lines.push("## Bundle Size");
    lines.push("");
    lines.push(...formatBundleSizeRows(bundleSize));
    lines.push("");
    lines.push(":warning: = size increase - :rocket: = size decrease");
    lines.push("");
  }

  lines.push("## Performance");
  lines.push("");

  if (hasSignificantChanges) {
    lines.push(...formatBenchmarkRows(significantRows));
  } else if (rows.length > 0) {
    lines.push("No significant performance changes detected.");
  } else if (newBenchmarks.length > 0 && removedBenchmarks.length === 0) {
    lines.push("No baseline results available for comparison.");
  } else if (newBenchmarks.length === 0 && removedBenchmarks.length > 0) {
    lines.push(
      "Some benchmarks were removed; no comparable benchmarks remain.",
    );
  } else if (newBenchmarks.length > 0 && removedBenchmarks.length > 0) {
    lines.push("All benchmarks were renamed; no comparison possible.");
  } else if (totalBenchmarks === 0) {
    lines.push("No performance results found.");
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
  if (pairedRoundsCount > 1) {
    lines.push("");
    lines.push(formatRoundsSummary(pairedRoundsCount));
  }

  return lines.join("\n");
}

const summary = compare();
const markdown = formatMarkdown(summary);

mkdirSync(RESULTS_DIR, { recursive: true });
writeFileSync(
  path.join(RESULTS_DIR, "comparison.json"),
  JSON.stringify(
    summary,
    (_key, value) => (value instanceof Map ? [...value.entries()] : value),
    2,
  ),
);
writeFileSync(path.join(RESULTS_DIR, "comparison.md"), markdown);

console.log(markdown);
