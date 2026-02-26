import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const COVERAGE_SUMMARY_PATH = path.join(
  "artifacts",
  "coverage",
  "coverage-summary.json"
);

const workspaceRoots = ["apps", "packages"];
const thresholdRaw = process.env.COVERAGE_MIN_LINES;
const hasThreshold = thresholdRaw !== undefined && thresholdRaw.trim() !== "";
const threshold = hasThreshold ? Number(thresholdRaw) : null;

if (hasThreshold && (!Number.isFinite(threshold) || threshold < 0 || threshold > 100)) {
  console.error(`Invalid COVERAGE_MIN_LINES value: "${thresholdRaw}". Expected 0-100.`);
  process.exit(1);
}

const workspaceSummaries = [];

for (const root of workspaceRoots) {
  if (!existsSync(root)) {
    continue;
  }

  const entries = readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const workspacePath = path.join(root, entry.name);
    const summaryPath = path.join(workspacePath, COVERAGE_SUMMARY_PATH);

    if (!existsSync(summaryPath)) {
      continue;
    }

    const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
    const total = summary?.total ?? {};

    workspaceSummaries.push({
      workspacePath,
      summaryPath,
      total
    });
  }
}

if (workspaceSummaries.length === 0) {
  console.error("No coverage summary files found.");
  console.error(
    `Expected: <workspace>/${COVERAGE_SUMMARY_PATH.replaceAll(path.sep, "/")}`
  );
  process.exit(1);
}

const metrics = ["lines", "statements", "functions", "branches"];

const aggregate = metrics.reduce((acc, metric) => {
  let covered = 0;
  let total = 0;

  for (const workspace of workspaceSummaries) {
    const metricSummary = workspace.total?.[metric];
    if (!metricSummary) {
      continue;
    }
    covered += metricSummary.covered ?? 0;
    total += metricSummary.total ?? 0;
  }

  const pct = total === 0 ? 100 : Number(((covered / total) * 100).toFixed(2));
  acc[metric] = { covered, total, pct };
  return acc;
}, {});

console.log("Coverage by workspace (lines):");
for (const workspace of workspaceSummaries) {
  const linesPct = workspace.total?.lines?.pct;
  const displayValue =
    typeof linesPct === "number" ? `${linesPct.toFixed(2)}%` : "n/a";
  console.log(`- ${workspace.workspacePath}: ${displayValue}`);
}

console.log("");
console.log("Aggregated coverage:");
for (const metric of metrics) {
  const metricSummary = aggregate[metric];
  console.log(
    `- ${metric}: ${metricSummary.pct.toFixed(2)}% (${metricSummary.covered}/${metricSummary.total})`
  );
}

if (threshold === null) {
  console.log("");
  console.log(
    "Coverage gate disabled. Set COVERAGE_MIN_LINES (0-100) to enforce minimum line coverage."
  );
  process.exit(0);
}

const aggregatedLineCoverage = aggregate.lines.pct;
if (aggregatedLineCoverage < threshold) {
  console.error("");
  console.error(
    `Coverage gate failed: ${aggregatedLineCoverage.toFixed(2)}% lines < ${threshold.toFixed(2)}% required.`
  );
  process.exit(1);
}

console.log("");
console.log(
  `Coverage gate passed: ${aggregatedLineCoverage.toFixed(2)}% lines >= ${threshold.toFixed(2)}% required.`
);
