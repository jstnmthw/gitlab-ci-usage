function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseLinkNext(header) {
  if (!header) return null;
  const match = header.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

const MAX_RETRIES = 3;

async function gitlabFetch(url, token, onRetry) {
  const headers = { "PRIVATE-TOKEN": token };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers });

    if (res.status === 429) {
      if (attempt === MAX_RETRIES) {
        await res.text();
        throw new Error(`GitLab API rate limit exceeded after ${MAX_RETRIES} retries — ${url}`);
      }
      const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
      if (onRetry) onRetry(`Rate limited — retrying in ${retryAfter}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
      await sleep(retryAfter * 1000);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitLab API error: ${res.status} ${res.statusText} — ${url}\n${body}`);
    }

    return res;
  }
}

async function fetchAllPages(url, token, onRetry) {
  const results = [];
  let nextUrl = url.includes("per_page") ? url : `${url}${url.includes("?") ? "&" : "?"}per_page=100`;

  while (nextUrl) {
    const res = await gitlabFetch(nextUrl, token, onRetry);
    const data = await res.json();
    results.push(...data);

    const link = res.headers.get("link");
    nextUrl = parseLinkNext(link);
  }
  return results;
}

export function createClient(config) {
  const { token, baseUrl } = config;
  const apiBase = `${baseUrl}/api/v4`;

  async function fetchProjects(groupId, projectId, onRetry) {
    if (projectId) {
      const res = await gitlabFetch(`${apiBase}/projects/${projectId}`, token, onRetry);
      const p = await res.json();
      return [{ id: p.id, name: p.name, path_with_namespace: p.path_with_namespace }];
    }

    const raw = await fetchAllPages(
      `${apiBase}/groups/${groupId}/projects?include_subgroups=true`,
      token,
      onRetry
    );
    return raw.map((p) => ({ id: p.id, name: p.name, path_with_namespace: p.path_with_namespace }));
  }

  async function fetchJobsInRange(projectId, startISO, onRetry) {
    const filtered = [];
    const startTime = new Date(startISO).getTime();
    let nextUrl = `${apiBase}/projects/${projectId}/jobs?per_page=100`;

    while (nextUrl) {
      const res = await gitlabFetch(nextUrl, token, onRetry);
      const data = await res.json();

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
