import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { validateEnv } from "../lib/config.js";

describe("validateEnv()", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ["GITLAB_TOKEN", "GITLAB_BASE_URL", "GITLAB_GROUP_ID"]) {
      savedEnv[key] = process.env[key];
      Reflect.deleteProperty(process.env, key);
    }
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = val;
    }
  });

  it("returns config when all vars are set", () => {
    process.env.GITLAB_TOKEN = "glpat-abc123";
    process.env.GITLAB_BASE_URL = "https://gitlab.example.com";
    process.env.GITLAB_GROUP_ID = "42";

    const config = validateEnv();
    expect(config).toEqual({
      token: "glpat-abc123",
      baseUrl: "https://gitlab.example.com",
      groupId: "42",
    });
  });

  it("exits on missing var", () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    process.env.GITLAB_TOKEN = "glpat-abc123";
    // Missing GITLAB_BASE_URL and GITLAB_GROUP_ID

    expect(() => validateEnv()).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it("strips trailing slashes from base URL", () => {
    process.env.GITLAB_TOKEN = "glpat-abc123";
    process.env.GITLAB_BASE_URL = "https://gitlab.example.com///";
    process.env.GITLAB_GROUP_ID = "42";

    const config = validateEnv();
    expect(config.baseUrl).toBe("https://gitlab.example.com");
  });

  it("exits when base URL is not HTTPS", () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    process.env.GITLAB_TOKEN = "glpat-abc123";
    process.env.GITLAB_BASE_URL = "http://gitlab.example.com";
    process.env.GITLAB_GROUP_ID = "42";

    expect(() => validateEnv()).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it("exits when group ID is not numeric", () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    process.env.GITLAB_TOKEN = "glpat-abc123";
    process.env.GITLAB_BASE_URL = "https://gitlab.example.com";
    process.env.GITLAB_GROUP_ID = "not-a-number";

    expect(() => validateEnv()).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });
});
