import { program } from "commander";
import chalk from "chalk";
import { subDays } from "date-fns";
import type { Config, ParsedArgs } from "./types.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(chalk.red(`Missing required environment variable: ${name}`));
    console.error(chalk.red("Copy .env.example to .env and fill in your values."));
    process.exit(1);
  }
  return value;
}

export function validateEnv(): Config {
  const token = requireEnv("GITLAB_TOKEN");
  const baseUrl = requireEnv("GITLAB_BASE_URL").replace(/\/+$/, "");
  const groupId = requireEnv("GITLAB_GROUP_ID");

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

export function parseArgs(): ParsedArgs {
  program
    .name("gitlab-ci-usage")
    .description("Calculate total GitLab CI job runtime across all projects in a group")
    .option("--days <number>", "number of days to look back", "30")
    .option("--project <id>", "restrict to a single project ID")
    .option("--output <filename>", "report filename", "gitlab-ci-usage-report.md")
    .option("--dry-run", "use mock data instead of calling the GitLab API")
    .parse();

  const opts = program.opts<{ days: string; project?: string; output: string; dryRun?: boolean }>();

  const days = parseInt(opts.days, 10);
  if (!Number.isInteger(days) || days <= 0) {
    console.error(chalk.red("--days must be a positive integer"));
    process.exit(1);
  }

  let project: number | undefined;
  if (opts.project !== undefined) {
    const pid = parseInt(opts.project, 10);
    if (!Number.isInteger(pid) || pid <= 0) {
      console.error(chalk.red("--project must be a valid numeric ID"));
      process.exit(1);
    }
    project = pid;
  }

  const endDate = new Date();
  const startDate = subDays(endDate, days);

  return { days, project, output: opts.output, startDate, endDate, dryRun: opts.dryRun === true };
}
