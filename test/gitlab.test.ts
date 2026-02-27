import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createClient } from "../lib/gitlab.js";
import {
  mockProjects,
  mockJobs,
  linkHeader,
  noLinkHeader,
} from "./fixtures/gitlab-api.js";
import type { GitLabClient } from "../lib/types.js";

const TOKEN = "glpat-test";
const BASE_URL = "https://gitlab.example.com";
const API = `${BASE_URL}/api/v4`;

function jsonResponse(
  data: unknown,
  headers: Record<string, string | null> = {},
): Response {
  const filteredHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v != null) filteredHeaders[k] = v;
  }
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json", ...filteredHeaders },
  });
}

describe("fetchProjects()", () => {
  let client: GitLabClient;

  beforeEach(() => {
    client = createClient({ token: TOKEN, baseUrl: BASE_URL });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns single project when projectId is provided", async () => {
    const project = mockProjects(1)[0];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(project));

    const result = await client.fetchProjects("99", 42);
    expect(result).toEqual([
      {
        id: project.id,
        name: project.name,
        path_with_namespace: project.path_with_namespace,
      },
    ]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API}/projects/42`,
      expect.objectContaining({ headers: { "PRIVATE-TOKEN": TOKEN } }),
    );
  });

  it("fetches group projects with pagination when no projectId", async () => {
    const page1 = mockProjects(2);
    const page2 = mockProjects(1).map((p) => ({ ...p, id: 10, name: "extra" }));

    const page2Url = `${API}/groups/99/projects?include_subgroups=true&per_page=100&page=2`;

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(page1, linkHeader(page2Url)))
      .mockResolvedValueOnce(jsonResponse(page2, noLinkHeader()));

    const result = await client.fetchProjects("99", undefined);
    expect(result).toHaveLength(3);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("fetchJobsInRange()", () => {
  let client: GitLabClient;

  beforeEach(() => {
    client = createClient({ token: TOKEN, baseUrl: BASE_URL });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filters jobs by date", async () => {
    const startISO = "2025-06-10T00:00:00.000Z";
    const jobs = mockJobs(12, { startDate: "2025-06-15T00:00:00Z" });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse(jobs, noLinkHeader()),
    );

    const result = await client.fetchJobsInRange(1, startISO);
    expect(result).toHaveLength(6);
    for (const job of result) {
      expect(String(job.finished_at) >= startISO).toBe(true);
    }
  });

  it("early-stops on old data", async () => {
    const startISO = "2025-06-13T00:00:00.000Z";
    const page1Jobs = mockJobs(4, { startDate: "2025-06-15T00:00:00Z" });
    const page2Url = `${API}/projects/1/jobs?per_page=100&page=2`;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse(page1Jobs, linkHeader(page2Url)),
    );

    const result = await client.fetchJobsInRange(1, startISO);
    expect(result).toHaveLength(3);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("skips jobs with null finished_at/duration/status", async () => {
    const jobs = [
      {
        id: 1,
        name: "good",
        finished_at: "2025-06-15T00:00:00.000Z",
        duration: 60,
        status: "success",
      },
      {
        id: 2,
        name: "no-finish",
        finished_at: null,
        duration: 60,
        status: "success",
      },
      {
        id: 3,
        name: "no-duration",
        finished_at: "2025-06-15T00:00:00.000Z",
        duration: null,
        status: "success",
      },
      {
        id: 4,
        name: "no-status",
        finished_at: "2025-06-15T00:00:00.000Z",
        duration: 60,
        status: null,
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse(jobs, noLinkHeader()),
    );

    const result = await client.fetchJobsInRange(1, "2025-06-01T00:00:00.000Z");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("good");
  });
});

describe("rate limiting", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("429 triggers retry with onRetry callback", async () => {
    vi.useFakeTimers();
    const client = createClient({ token: TOKEN, baseUrl: BASE_URL });
    const project = mockProjects(1)[0];
    const onRetry = vi.fn();

    const rateLimitResponse = new Response("", {
      status: 429,
      headers: { "Retry-After": "0" },
    });
    const successResponse = jsonResponse(project);

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse);

    const promise = client.fetchProjects("99", project.id, onRetry);
    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(onRetry).toHaveBeenCalledWith(
      expect.stringContaining("Rate limited"),
    );
    expect(result).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all retries", async () => {
    vi.useFakeTimers();
    const client = createClient({ token: TOKEN, baseUrl: BASE_URL });

    const make429 = (): Response =>
      new Response("", {
        status: 429,
        headers: { "Retry-After": "0" },
      });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(make429())
      .mockResolvedValueOnce(make429())
      .mockResolvedValueOnce(make429())
      .mockResolvedValueOnce(make429());

    const promise = client.fetchProjects("99", 1).catch((e: unknown) => e);
    await vi.runAllTimersAsync();

    const err = await promise;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(
      /rate limit exceeded after 3 retries/,
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });
});

describe("5xx server error retry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("retries 5xx with exponential backoff and succeeds", async () => {
    vi.useFakeTimers();
    const client = createClient({ token: TOKEN, baseUrl: BASE_URL });
    const project = mockProjects(1)[0];
    const onRetry = vi.fn();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("Bad Gateway", { status: 502, statusText: "Bad Gateway" }),
      )
      .mockResolvedValueOnce(
        new Response("Service Unavailable", {
          status: 503,
          statusText: "Service Unavailable",
        }),
      )
      .mockResolvedValueOnce(jsonResponse(project));

    const promise = client.fetchProjects("99", project.id, onRetry);
    await vi.advanceTimersByTimeAsync(1000); // 1s backoff (attempt 0)
    await vi.advanceTimersByTimeAsync(2000); // 2s backoff (attempt 1)
    const result = await promise;

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(
      expect.stringContaining("Server error 502"),
    );
    expect(onRetry).toHaveBeenCalledWith(
      expect.stringContaining("Server error 503"),
    );
    expect(result).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting retries on 5xx", async () => {
    vi.useFakeTimers();
    const client = createClient({ token: TOKEN, baseUrl: BASE_URL });

    const make5xx = (): Response =>
      new Response("Bad Gateway", { status: 502, statusText: "Bad Gateway" });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(make5xx())
      .mockResolvedValueOnce(make5xx())
      .mockResolvedValueOnce(make5xx())
      .mockResolvedValueOnce(make5xx());

    const promise = client.fetchProjects("99", 1).catch((e: unknown) => e);
    await vi.runAllTimersAsync();

    const err = await promise;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/server error after 3 retries.*502/);
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });
});

describe("proactive rate-limit throttling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("pauses when RateLimit-Remaining is below threshold", async () => {
    vi.useFakeTimers();
    const client = createClient({ token: TOKEN, baseUrl: BASE_URL });
    const project = mockProjects(1)[0];
    const onRetry = vi.fn();

    const resetEpoch = String(Math.floor(Date.now() / 1000) + 3);
    const response = jsonResponse(project, {
      "RateLimit-Remaining": "10",
      "RateLimit-Reset": resetEpoch,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);

    const promise = client.fetchProjects("99", project.id, onRetry);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(onRetry).toHaveBeenCalledWith(
      expect.stringContaining("Rate limit low"),
    );
    expect(result).toHaveLength(1);
  });

  it("does not pause when RateLimit-Remaining is above threshold", async () => {
    const client = createClient({ token: TOKEN, baseUrl: BASE_URL });
    const project = mockProjects(1)[0];
    const onRetry = vi.fn();

    const response = jsonResponse(project, {
      "RateLimit-Remaining": "500",
      "RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);

    const result = await client.fetchProjects("99", project.id, onRetry);

    expect(onRetry).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});

describe("error handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("non-OK non-retryable response throws error", async () => {
    const client = createClient({ token: TOKEN, baseUrl: BASE_URL });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Forbidden", {
        status: 403,
        statusText: "Forbidden",
      }),
    );

    await expect(client.fetchProjects("99", 1)).rejects.toThrow(
      /GitLab API error.*403/,
    );
  });
});
