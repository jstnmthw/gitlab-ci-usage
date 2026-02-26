/**
 * Factory functions returning realistic GitLab API response shapes.
 */

import type { GitLabProject, GitLabJob } from "../../lib/types.js";

export function mockProjects(n: number): GitLabProject[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `project-${String(i + 1)}`,
    path_with_namespace: `group/project-${String(i + 1)}`,
  }));
}

export function mockJobs(n: number, { startDate }: { startDate?: string } = {}): GitLabJob[] {
  const base = startDate ? new Date(startDate) : new Date("2025-06-15T00:00:00Z");
  return Array.from({ length: n }, (_, i) => ({
    id: 1000 + i,
    name: `job-${String(i)}`,
    finished_at: new Date(base.getTime() - i * 86_400_000).toISOString(),
    duration: 60 + i * 10,
    status: "success",
  }));
}

export function linkHeader(nextUrl: string): Record<string, string> {
  return { link: `<${nextUrl}>; rel="next"` };
}

export function noLinkHeader(): Record<string, string | null> {
  return { link: null };
}
