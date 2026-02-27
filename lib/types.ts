export interface Config {
  token: string;
  baseUrl: string;
}

export interface ParsedArgs {
  groupId: string;
  days: number;
  project: number | undefined;
  output: string;
  startDate: Date;
  endDate: Date;
  mock: boolean;
}

export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
}

export interface GitLabJob {
  id: number;
  name: string;
  finished_at: string | null;
  duration: number | null;
  status: string | null;
}

export interface ProjectStat extends GitLabProject {
  totalJobs: number;
  totalDurationSeconds: number;
  totalMinutes: number;
  totalHours: number;
  percentOfTotal: number;
}

export interface Summary {
  generatedAt: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  days: number;
  baseUrl: string;
  groupId: string;
  projectCount: number;
  grandTotalJobs: number;
  grandTotalMinutes: number;
  grandTotalHours: number;
  projectStats: ProjectStat[];
}

export type OnRetry = (msg: string) => void;

export interface GitLabClient {
  fetchProjects(groupId: string, projectId: number | undefined, onRetry?: OnRetry): Promise<GitLabProject[]>;
  fetchJobsInRange(projectId: number, startISO: string, onRetry?: OnRetry): Promise<GitLabJob[]>;
}
