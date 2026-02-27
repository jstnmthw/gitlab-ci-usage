import type { Config, GitLabProject, GitLabJob, GitLabClient, OnRetry } from "./types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseLinkNext(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

const MAX_RETRIES = 3;

async function gitlabFetch(url: string, token: string, onRetry?: OnRetry): Promise<Response> {
  const headers = { "PRIVATE-TOKEN": token };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers });

    if (res.status === 429) {
      if (attempt === MAX_RETRIES) {
        await res.text();
        throw new Error(`GitLab API rate limit exceeded after ${String(MAX_RETRIES)} retries — ${url}`);
      }
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10);
      if (onRetry) onRetry(`Rate limited — retrying in ${String(retryAfter)}s (attempt ${String(attempt + 1)}/${String(MAX_RETRIES)})...`);
      await sleep(retryAfter * 1000);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitLab API error: ${String(res.status)} ${res.statusText} — ${url}\n${body}`);
    }

    return res;
  }

  // Unreachable, but satisfies TypeScript
  throw new Error("Unexpected: exhausted retry loop");
}

async function fetchAllPages(url: string, token: string, onRetry?: OnRetry): Promise<unknown[]> {
  const results: unknown[] = [];
  let nextUrl: string | null = url.includes("per_page") ? url : `${url}${url.includes("?") ? "&" : "?"}per_page=100`;

  while (nextUrl) {
    const res = await gitlabFetch(nextUrl, token, onRetry);
    const data = (await res.json()) as unknown[];
    results.push(...data);

    const link = res.headers.get("link");
    nextUrl = parseLinkNext(link);
  }
  return results;
}

export function createClient(config: Pick<Config, "token" | "baseUrl">): GitLabClient {
  const { token, baseUrl } = config;
  const apiBase = `${baseUrl}/api/v4`;

  async function fetchProjects(groupId: string | undefined, projectId: number | undefined, onRetry?: OnRetry): Promise<GitLabProject[]> {
    if (projectId) {
      const res = await gitlabFetch(`${apiBase}/projects/${String(projectId)}`, token, onRetry);
      const p = (await res.json()) as GitLabProject;
      return [{ id: p.id, name: p.name, path_with_namespace: p.path_with_namespace }];
    }

    const raw = await fetchAllPages(
      `${apiBase}/groups/${groupId}/projects?include_subgroups=true`,
      token,
      onRetry,
    );
    return (raw as GitLabProject[]).map((p) => ({ id: p.id, name: p.name, path_with_namespace: p.path_with_namespace }));
  }

  async function fetchJobsInRange(projectId: number, startISO: string, onRetry?: OnRetry): Promise<GitLabJob[]> {
    const filtered: GitLabJob[] = [];
    const startTime = new Date(startISO).getTime();
    let nextUrl: string | null = `${apiBase}/projects/${String(projectId)}/jobs?per_page=100`;

    while (nextUrl) {
      const res = await gitlabFetch(nextUrl, token, onRetry);
      const data = (await res.json()) as GitLabJob[];

      let hitOldData = false;
      for (const job of data) {
        if (!job.finished_at || job.duration == null || job.status == null) continue;

        const finishedTime = new Date(job.finished_at).getTime();

        if (finishedTime < startTime) {
          hitOldData = true;
          break;
        }

        filtered.push(job);
      }

      if (hitOldData || data.length === 0) break;

      const link = res.headers.get("link");
      nextUrl = parseLinkNext(link);
    }

    return filtered;
  }

  return { fetchProjects, fetchJobsInRange };
}
