import type { GitLabClient, GitLabProject, GitLabJob } from "./types.js";

interface MockProjectProfile {
  project: GitLabProject;
  jobCount: number;
  baseDuration: number; // seconds
}

const MOCK_PROJECTS: MockProjectProfile[] = [
  {
    project: {
      id: 101,
      name: "frontend",
      path_with_namespace: "acme/frontend",
    },
    jobCount: 85,
    baseDuration: 240,
  },
  {
    project: {
      id: 102,
      name: "backend-api",
      path_with_namespace: "acme/backend-api",
    },
    jobCount: 62,
    baseDuration: 180,
  },
  {
    project: {
      id: 103,
      name: "mobile-app",
      path_with_namespace: "acme/mobile-app",
    },
    jobCount: 45,
    baseDuration: 360,
  },
  {
    project: { id: 104, name: "infra", path_with_namespace: "acme/infra" },
    jobCount: 20,
    baseDuration: 90,
  },
  {
    project: {
      id: 105,
      name: "docs-site",
      path_with_namespace: "acme/docs-site",
    },
    jobCount: 12,
    baseDuration: 45,
  },
  {
    project: {
      id: 106,
      name: "shared-libs",
      path_with_namespace: "acme/shared-libs",
    },
    jobCount: 30,
    baseDuration: 120,
  },
];

function generateJobs(
  profile: MockProjectProfile,
  startDate: Date,
): GitLabJob[] {
  const now = Date.now();
  const rangeMs = now - startDate.getTime();
  const jobs: GitLabJob[] = [];

  for (let i = 0; i < profile.jobCount; i++) {
    const offsetMs = Math.round((i / profile.jobCount) * rangeMs);
    const finishedAt = new Date(
      startDate.getTime() + offsetMs + Math.round(Math.random() * 3600000),
    );
    // vary duration ±30 %
    const duration = Math.round(
      profile.baseDuration * (0.7 + Math.random() * 0.6),
    );

    jobs.push({
      id: profile.project.id * 10000 + i,
      name: ["build", "test", "lint", "deploy"][i % 4],
      finished_at: finishedAt.toISOString(),
      duration,
      status: "success",
    });
  }

  return jobs;
}

export function createMockClient(startDate: Date): GitLabClient {
  const jobCache = new Map<number, GitLabJob[]>();

  for (const profile of MOCK_PROJECTS) {
    jobCache.set(profile.project.id, generateJobs(profile, startDate));
  }

  return {
    fetchProjects(_groupId, projectId) {
      if (projectId !== undefined) {
        const found = MOCK_PROJECTS.find((p) => p.project.id === projectId);
        return Promise.resolve(found ? [found.project] : []);
      }
      return Promise.resolve(MOCK_PROJECTS.map((p) => p.project));
    },

    fetchJobsInRange(projectId) {
      return Promise.resolve(jobCache.get(projectId) ?? []);
    },
  };
}
