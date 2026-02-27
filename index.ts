#!/usr/bin/env tsx

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import pLimit from "p-limit";
import { formatISO, format } from "date-fns";
import { validateEnv, parseArgs } from "./lib/config.js";
import { createClient } from "./lib/gitlab.js";
import { createMockClient } from "./lib/mock-client.js";
import { printCLIReport, buildMarkdownReport } from "./lib/report.js";
import type { GitLabClient, ProjectStat } from "./lib/types.js";

// ── Configuration ────────────────────────────────────────────────────

try {
  process.loadEnvFile();
} catch {
  /* no .env file — rely on environment variables */
}
const args = parseArgs();

let baseUrl: string;
let client: GitLabClient;

if (args.mock) {
  console.log(
    chalk.yellow("Mock mode — using mock data, no API calls will be made.\n"),
  );
  baseUrl = "https://gitlab.example.com";
  client = createMockClient(args.startDate);
} else {
  const config = validateEnv();
  baseUrl = config.baseUrl;
  client = createClient(config);
}

// ── Helpers ──────────────────────────────────────────────────────────

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ── Main ─────────────────────────────────────────────────────────────

const spinner = ora("Starting...").start();
const onRetry = (msg: string): void => {
  spinner.text = msg;
};

try {
  // Fetch projects
  spinner.text = "Fetching projects...";
  const projects = await client.fetchProjects(
    args.groupId,
    args.project,
    onRetry,
  );

  if (projects.length === 0) {
    spinner.warn("No projects found in this group.");
    process.exit(0);
  }

  // Fetch jobs per project with concurrency control
  const limit = pLimit(5);
  let completed = 0;
  const startISO = args.startDate.toISOString();

  const projectResults = await Promise.all(
    projects.map((project) =>
      limit(async () => {
        spinner.text = `Fetching jobs... (${String(++completed)}/${String(projects.length)} projects)`;
        const jobs = await client.fetchJobsInRange(
          project.id,
          startISO,
          onRetry,
        );
        return { project, jobs };
      }),
    ),
  );

  // Aggregate
  spinner.text = "Aggregating data...";

  let grandTotalJobs = 0;
  let grandTotalSeconds = 0;

  const projectStats: ProjectStat[] = projectResults.map(
    ({ project, jobs }) => {
      const totalJobs = jobs.length;
      const totalDurationSeconds = jobs.reduce(
        (sum, j) => sum + (j.duration ?? 0),
        0,
      );
      const totalMinutes = round2(totalDurationSeconds / 60);
      const totalHours = round2(totalMinutes / 60);
      grandTotalJobs += totalJobs;
      grandTotalSeconds += totalDurationSeconds;
      return {
        ...project,
        totalJobs,
        totalDurationSeconds,
        totalMinutes,
        totalHours,
        percentOfTotal: 0,
      };
    },
  );

  const grandTotalMinutes = round2(grandTotalSeconds / 60);
  const grandTotalHours = round2(grandTotalSeconds / 3600);

  for (const p of projectStats) {
    p.percentOfTotal =
      grandTotalMinutes > 0
        ? round2((p.totalMinutes / grandTotalMinutes) * 100)
        : 0;
  }

  projectStats.sort((a, b) => b.totalMinutes - a.totalMinutes);

  const summary = {
    generatedAt: formatISO(new Date()),
    dateRangeStart: format(args.startDate, "yyyy-MM-dd"),
    dateRangeEnd: format(args.endDate, "yyyy-MM-dd"),
    days: args.days,
    baseUrl,
    groupId: args.groupId,
    projectCount: projects.length,
    grandTotalJobs,
    grandTotalMinutes,
    grandTotalHours,
    projectStats,
  };

  // Output
  spinner.succeed("Done!");
  printCLIReport(summary);

  const md = buildMarkdownReport(summary);
  const reportsDir = resolve(import.meta.dirname, "reports");
  mkdirSync(reportsDir, { recursive: true });
  const stamp = format(new Date(), "yyyyMMdd-HHmmss");
  const ext = args.output.lastIndexOf(".");
  const filename =
    ext === -1
      ? `${args.output}-${stamp}`
      : `${args.output.slice(0, ext)}-${stamp}${args.output.slice(ext)}`;
  const outputPath = resolve(reportsDir, filename);
  writeFileSync(outputPath, md);
  console.log(chalk.green(`Report written to ${outputPath}`));

  process.exit(0);
} catch (err) {
  spinner.fail("Failed");
  console.error(chalk.red((err as Error).message));
  process.exit(1);
}
