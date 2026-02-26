import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { program } from "commander";
import chalk from "chalk";
import { subDays } from "date-fns";

export function loadEnv(dir = resolve(import.meta.dirname, "..")) {
  try {
    const content = readFileSync(resolve(dir, ".env"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const raw = trimmed.slice(idx + 1).trim();
      const value = raw.replace(/^(["'])(.*)\1$/, "$2");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // No .env file — rely on environment variables
  }
}

export function validateEnv() {
  const token = process.env.GITLAB_TOKEN;
  const baseUrl = process.env.GITLAB_BASE_URL?.replace(/\/+$/, "");
  const groupId = process.env.GITLAB_GROUP_ID;

  for (const [name, value] of Object.entries({
    GITLAB_TOKEN: token,
    GITLAB_BASE_URL: baseUrl,
    GITLAB_GROUP_ID: groupId,
  })) {
    if (!value) {
      console.error(chalk.red(`Missing required environment variable: ${name}`));
      console.error(chalk.red("Copy .env.example to .env and fill in your values."));
      process.exit(1);
    }
  }

  if (!baseUrl.startsWith("https://")) {
    console.error(chalk.red("GITLAB_BASE_URL must use HTTPS to protect your token in transit."));
    process.exit(1);
  }

  if (!/^\d+$/.test(groupId)) {
    console.error(chalk.red("GITLAB_GROUP_ID must be a numeric ID."));
    process.exit(1);
  }

  return { token, baseUrl, groupId };
}

export function parseArgs() {
  program
    .name("gitlab-ci-usage")
    .description("Calculate total GitLab CI job runtime across all projects in a group")
    .option("--days <number>", "number of days to look back", "30")
    .option("--project <id>", "restrict to a single project ID")
    .option("--output <filename>", "report filename", "gitlab-ci-usage-report.md")
    .parse();

  const opts = program.opts();

  const days = parseInt(opts.days, 10);
  if (!Number.isInteger(days) || days <= 0) {
    console.error(chalk.red("--days must be a positive integer"));
    process.exit(1);
  }

  if (opts.project !== undefined) {
    const pid = parseInt(opts.project, 10);
    if (!Number.isInteger(pid) || pid <= 0) {
      console.error(chalk.red("--project must be a valid numeric ID"));
      process.exit(1);
    }
    opts.project = pid;
  }

  const endDate = new Date();
  const startDate = subDays(endDate, days);

  return { days, project: opts.project, output: opts.output, startDate, endDate };
}
