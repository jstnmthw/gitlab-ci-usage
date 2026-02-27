# gitlab-ci-usage

Lightweight CLI tool that calculates total GitLab CI job runtime across all projects in a group and generates a Markdown report. Useful for understanding CI consumption, estimating costs, and identifying high-usage projects.

## Prerequisites

- Node.js 20+
- pnpm (or npm/yarn)
- TypeScript 5.9+
- GitLab personal access token with `read_api` scope

## Setup

```bash
pnpm install
cp .env.example .env
# Edit .env with your GitLab token, base URL, and group ID
```

## Usage

```bash
# Analyze the last 30 days (default)
pnpm start

# Look back 90 days
pnpm start --days 90

# Restrict to a single project
pnpm start --project 12345

# Custom output filename
pnpm start --output report.md

# Preview with mock data (no GitLab credentials needed)
pnpm start --mock
pnpm start --mock --days 7 --output preview.md
```

## CLI Options

| Option | Description | Default |
| ------ | ----------- | ------- |
| `--days <number>` | Number of days to look back | `30` |
| `--project <id>` | Restrict to a single project | — |
| `--output <filename>` | Report filename | `report.md` |
| `--mock` | Generate a report with mock data (no GitLab credentials needed) | — |

## Environment Variables

All three variables are required. Define them in a `.env` file at the project root (copy `.env.example` to get started) or export them in your shell. The tool reads `.env` automatically but will not overwrite variables already set in the environment.

```bash
# .env
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_BASE_URL=https://gitlab.com
GITLAB_GROUP_ID=12345
```

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `GITLAB_TOKEN` | Yes | GitLab personal access token (see [GitLab Token Scopes](#gitlab-token-scopes)) |
| `GITLAB_BASE_URL` | Yes | `https://gitlab.com` for GitLab.com, or your self-hosted instance URL (e.g. `https://gitlab.example.com`) |
| `GITLAB_GROUP_ID` | Yes | Numeric ID of the group to analyze (found on the group's **Settings → General** page) |

## GitLab Token Scopes

Your personal access token needs the `read_api` scope, which grants read-only access to the API.

Create one at: **Settings → Access Tokens** or see the [GitLab PAT documentation](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html).

## Output

The tool produces:

1. **CLI output** — A color-formatted summary with per-project breakdown, printed to stdout.
2. **Markdown report** — A detailed report written to `reports/` (default: `reports/report.md`) with metadata, cost projection placeholders, and a per-project table.

## How It Works

1. Loads configuration from `.env` and CLI arguments.
2. Fetches all projects in the specified group (including subgroups) via the GitLab API, or a single project if `--project` is provided.
3. Fetches CI jobs for each project concurrently (up to 5 at a time), filtering to the configured date range. Pagination stops early when it encounters jobs older than the start date.
4. Aggregates durations and computes per-project and total minutes/hours.
5. Prints a color-formatted CLI summary and writes a Markdown report to disk.

Rate-limited responses (HTTP 429) are automatically retried after the `Retry-After` interval.

## Project Structure

```
├── index.ts               # CLI entrypoint and orchestration
├── lib/
│   ├── types.ts           # Shared type definitions
│   ├── config.ts          # env validation, CLI arg parsing
│   ├── gitlab.ts          # GitLab API client (pagination, rate-limit retry)
│   ├── mock-client.ts     # Mock GitLab client for --mock mode
│   └── report.ts          # CLI and Markdown report generation
├── test/
│   ├── fixtures/
│   │   └── gitlab-api.ts  # Mock response factories
│   ├── config.test.ts     # Tests for config loading and validation
│   ├── gitlab.test.ts     # Tests for API client with mocked fetch
│   └── report.test.ts     # Tests for report output
├── tsconfig.json          # TypeScript config (type-checking only)
├── eslint.config.js       # ESLint + typescript-eslint config
└── vitest.config.ts
```

## Testing

Tests use [Vitest](https://vitest.dev/) with mocked `global.fetch` — no real GitLab calls are made.

```bash
# Run all tests
pnpm test

# Type-check without emitting
pnpm check-types

# Lint
pnpm lint

# Verbose output
pnpm vitest run --reporter=verbose

# Watch mode during development
pnpm vitest
```

### Coverage

| Module | What's tested |
| ------ | ------------- |
| `lib/config.ts` | env validation, missing var exits, trailing slash stripping |
| `lib/gitlab.ts` | Single-project fetch, paginated group fetch, date filtering, early-stop on old data, incomplete job filtering, 429 retry, error throwing |
| `lib/report.ts` | Markdown structure and sections, table row correctness, locale number formatting, CLI stdout output |
