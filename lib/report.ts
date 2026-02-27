import chalk from "chalk";
import type { Summary } from "./types.js";

const fmt = (n: number): string => n.toLocaleString("en-US");

export function printCLIReport(summary: Summary): void {
  const {
    dateRangeStart,
    dateRangeEnd,
    generatedAt,
    projectCount,
    grandTotalJobs,
    grandTotalMinutes,
    grandTotalHours,
    projectStats,
  } = summary;

  console.log("");
  console.log(chalk.cyan("── GitLab CI Usage Report ──────────────────"));
  console.log(
    `${chalk.cyan("Date Range:")}        ${dateRangeStart} → ${dateRangeEnd}`,
  );
  console.log(`${chalk.cyan("Generated At:")}      ${generatedAt}`);
  console.log(
    `${chalk.cyan("Projects Analyzed:")} ${chalk.bold.green(fmt(projectCount))}`,
  );
  console.log(
    `${chalk.cyan("Total Jobs:")}        ${chalk.bold.green(fmt(grandTotalJobs))}`,
  );
  console.log(
    `${chalk.cyan("Total CI Minutes:")}  ${chalk.bold.green(fmt(grandTotalMinutes))}`,
  );
  console.log(
    `${chalk.cyan("Total CI Hours:")}    ${chalk.bold.green(fmt(grandTotalHours))}`,
  );
  console.log(chalk.cyan("─────────────────────────────────────────────"));
  console.log("");

  for (const p of projectStats) {
    if (p.totalJobs === 0) continue;
    console.log(
      `  ${chalk.bold(p.path_with_namespace)}  ` +
        `${chalk.bold.green(fmt(p.totalJobs))} jobs · ` +
        `${chalk.bold.green(fmt(p.totalMinutes))} min · ` +
        `${chalk.bold.green(fmt(p.totalHours))} hrs · ` +
        chalk.yellow(String(p.percentOfTotal) + "%"),
    );
  }

  console.log("");
}

export function buildMarkdownReport(summary: Summary): string {
  const {
    generatedAt,
    dateRangeStart,
    dateRangeEnd,
    days,
    baseUrl,
    groupId,
    projectCount,
    grandTotalJobs,
    grandTotalMinutes,
    grandTotalHours,
    projectStats,
  } = summary;

  const lines: string[] = [
    "# GitLab CI Usage Report",
    "",
    "## Metadata",
    "",
    `- **Generated At:** ${generatedAt}`,
    `- **Date Range:** ${dateRangeStart} → ${dateRangeEnd}`,
    `- **Days Analyzed:** ${String(days)}`,
    `- **GitLab Base URL:** ${baseUrl}`,
    `- **Group ID:** ${groupId ?? "N/A"}`,
    `- **Projects Analyzed:** ${fmt(projectCount)}`,
    `- **Total Jobs:** ${fmt(grandTotalJobs)}`,
    `- **Total CI Minutes:** ${fmt(grandTotalMinutes)}`,
    `- **Total CI Hours:** ${fmt(grandTotalHours)}`,
    "",
    "## Cost Projection",
    "",
    "### Cost Modeling",
    "",
    `- Estimated Cost Per Minute: ______`,
    `- Projected Monthly Cost: ______`,
    `- Current Runner Cost: ______`,
    `- Difference: ______`,
    "",
    "## Per-Project Breakdown",
    "",
    "| Project | Jobs | Minutes | Hours | % of Total |",
    "| ------- | ---: | ------: | ----: | ---------: |",
  ];

  for (const p of projectStats) {
    lines.push(
      `| ${p.path_with_namespace} | ${fmt(p.totalJobs)} | ${fmt(p.totalMinutes)} | ${fmt(p.totalHours)} | ${String(p.percentOfTotal)}% |`,
    );
  }

  lines.push(
    "",
    "## Notes",
    "",
    "*CI minutes are calculated as the sum of job durations within the selected window.*",
    "",
  );

  return lines.join("\n");
}
