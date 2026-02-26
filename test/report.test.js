import { describe, it, expect, vi, afterEach } from "vitest";
import { buildMarkdownReport, printCLIReport } from "../lib/report.js";

function makeSummary(overrides = {}) {
  return {
    generatedAt: "2025-06-15 12:00:00",
    dateRangeStart: "2025-05-16",
    dateRangeEnd: "2025-06-15",
    days: 30,
    baseUrl: "https://gitlab.example.com",
    groupId: "42",
    projectCount: 3,
    grandTotalJobs: 1500,
    grandTotalMinutes: 12345,
    grandTotalHours: 205,
    projectStats: [
      { path_with_namespace: "group/project-1", totalJobs: 800, totalMinutes: 7000, totalHours: 116, percentOfTotal: 56.7 },
      { path_with_namespace: "group/project-2", totalJobs: 500, totalMinutes: 3345, totalHours: 55, percentOfTotal: 27.1 },
      { path_with_namespace: "group/project-3", totalJobs: 200, totalMinutes: 2000, totalHours: 33, percentOfTotal: 16.2 },
    ],
    ...overrides,
  };
}

describe("buildMarkdownReport()", () => {
  it("returns valid markdown with all sections", () => {
    const md = buildMarkdownReport(makeSummary());

    expect(md).toContain("# GitLab CI Usage Report");
    expect(md).toContain("## Metadata");
    expect(md).toContain("## Per-Project Breakdown");
    expect(md).toContain("## Notes");
    expect(md).toContain("Generated At:");
    expect(md).toContain("Date Range:");
  });

  it("table rows match projectStats", () => {
    const summary = makeSummary();
    const md = buildMarkdownReport(summary);

    for (const p of summary.projectStats) {
      expect(md).toContain(p.path_with_namespace);
      expect(md).toContain(`${p.percentOfTotal}%`);
    }
  });

  it("formats numbers with locale separators", () => {
    const summary = makeSummary({ grandTotalJobs: 1500, grandTotalMinutes: 12345 });
    const md = buildMarkdownReport(summary);

    expect(md).toContain("1,500");
    expect(md).toContain("12,345");
  });
});

describe("printCLIReport()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes to stdout", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printCLIReport(makeSummary());

    const output = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("GitLab CI Usage Report");
    expect(output).toContain("Total Jobs:");
    expect(output).toContain("group/project-1");
  });
});
