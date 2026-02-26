/**
 * Factory functions returning realistic GitLab API response shapes.
 */

export function mockProjects(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `project-${i + 1}`,
    path_with_namespace: `group/project-${i + 1}`,
  }));
}

export function mockJobs(n, { startDate } = {}) {
  const base = startDate ? new Date(startDate) : new Date("2025-06-15T00:00:00Z");
  return Array.from({ length: n }, (_, i) => ({
    id: 1000 + i,
    name: `job-${i}`,
    finished_at: new Date(base.getTime() - i * 86_400_000).toISOString(),
    duration: 60 + i * 10,
    status: "success",
  }));
}

export function linkHeader(nextUrl) {
  return { link: `<${nextUrl}>; rel="next"` };
}

export function noLinkHeader() {
  return { link: null };
}
