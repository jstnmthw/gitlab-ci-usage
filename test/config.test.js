import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

// We need to import loadEnv and validateEnv fresh or manage env carefully.
import { loadEnv, validateEnv } from "../lib/config.js";

describe("loadEnv()", () => {
  let tempDir;
  const savedEnv = {};

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "gitlab-ci-usage-test-"));
    // Save and clear relevant env vars
    for (const key of ["TEST_VAR_A", "TEST_VAR_B", "GITLAB_TOKEN", "GITLAB_BASE_URL", "GITLAB_GROUP_ID"]) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore env
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  it("reads a .env file into process.env", () => {
    writeFileSync(join(tempDir, ".env"), "TEST_VAR_A=hello\nTEST_VAR_B=world\n");
    loadEnv(tempDir);
    expect(process.env.TEST_VAR_A).toBe("hello");
    expect(process.env.TEST_VAR_B).toBe("world");
  });

  it("skips comments and blank lines", () => {
    writeFileSync(join(tempDir, ".env"), "# this is a comment\n\nTEST_VAR_A=value\n\n# another comment\n");
    loadEnv(tempDir);
    expect(process.env.TEST_VAR_A).toBe("value");
  });

  it("does not overwrite existing vars", () => {
    process.env.TEST_VAR_A = "original";
    writeFileSync(join(tempDir, ".env"), "TEST_VAR_A=overwritten\n");
    loadEnv(tempDir);
    expect(process.env.TEST_VAR_A).toBe("original");
  });

  it("strips surrounding double quotes from values", () => {
    writeFileSync(join(tempDir, ".env"), 'TEST_VAR_A="hello world"\n');
    loadEnv(tempDir);
    expect(process.env.TEST_VAR_A).toBe("hello world");
  });

  it("strips surrounding single quotes from values", () => {
    writeFileSync(join(tempDir, ".env"), "TEST_VAR_A='hello world'\n");
    loadEnv(tempDir);
    expect(process.env.TEST_VAR_A).toBe("hello world");
  });

  it("does not strip mismatched quotes", () => {
    writeFileSync(join(tempDir, ".env"), "TEST_VAR_A=\"hello'\n");
    loadEnv(tempDir);
    expect(process.env.TEST_VAR_A).toBe("\"hello'");
  });
});

describe("validateEnv()", () => {
  const savedEnv = {};

  beforeEach(() => {
    for (const key of ["GITLAB_TOKEN", "GITLAB_BASE_URL", "GITLAB_GROUP_ID"]) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
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
