# gitlab-ci-usage

Lightweight CLI tool that calculates total GitLab CI job runtime across all projects in a group and generates a Markdown report. Useful for understanding CI consumption, estimating costs, and identifying high-usage projects.

## Prerequisites

- Node.js 20+
- pnpm (or npm/yarn)
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
node index.js

# Look back 90 days
node index.js --days 90

# Restrict to a single project
node index.js --project 12345

# Custom output filename
node index.js --output report.md
```

## CLI Options

| Option | Description | Default |
| ------ | ----------- | ------- |
| `--days <number>` | Number of days to look back | `30` |
| `--project <id>` | Restrict to a single project | — |
| `--output <filename>` | Report filename | `gitlab-ci-usage-report.md` |

## Environment Variables

Configured via a `.env` file or exported in your shell. The tool reads `.env` automatically but will not overwrite variables already set in the environment.

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `GITLAB_TOKEN` | Yes | GitLab personal access token |
| `GITLAB_BASE_URL` | Yes | GitLab instance URL (e.g. `https://gitlab.com`) |
| `GITLAB_GROUP_ID` | Yes | Numeric ID of the group to analyze |

## GitLab Token Scopes

Your personal access token needs the `read_api` scope, which grants read-only access to the API.

Create one at: **Settings → Access Tokens** or see the [GitLab PAT documentation](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html).

## Output

The tool produces:

1. **CLI output** — A color-formatted summary with per-project breakdown, printed to stdout.
2. **Markdown report** — A detailed report written to the output file (default: `gitlab-ci-usage-report.md`) with metadata, cost projection placeholders, and a per-project table.

## How It Works

1. Loads configuration from `.env` and CLI arguments.
2. Fetches all projects in the specified group (including subgroups) via the GitLab API, or a single project if `--project` is provided.
3. Fetches CI jobs for each project concurrently (up to 5 at a time), filtering to the configured date range. Pagination stops early when it encounters jobs older than the start date.
4. Aggregates durations and computes per-project and total minutes/hours.
5. Prints a color-formatted CLI summary and writes a Markdown report to disk.

Rate-limited responses (HTTP 429) are automatically retried after the `Retry-After` interval.

## Project Structure

```
├── index.js              # CLI entrypoint and orchestration
├── lib/
│   ├── config.js         # .env loading, env validation, CLI arg parsing
│   ├── gitlab.js         # GitLab API client (pagination, rate-limit retry)
│   └── report.js         # CLI and Markdown report generation
├── test/
│   ├── fixtures/
│   │   └── gitlab-api.js # Mock response factories
│   ├── config.test.js    # Tests for config loading and validation
│   ├── gitlab.test.js    # Tests for API client with mocked fetch
│   └── report.test.js    # Tests for report output
└── vitest.config.js
```

## Testing

Tests use [Vitest](https://vitest.dev/) with mocked `global.fetch` — no real GitLab calls are made.

```bash
# Run all tests
pnpm test

# Verbose output
pnpm vitest run --reporter=verbose

# Watch mode during development
pnpm vitest
```

### Coverage

| Module | What's tested |
| ------ | ------------- |
| `lib/config.js` | `.env` parsing, comment/blank handling, no-clobber behavior, env validation, missing var exits, trailing slash stripping |
| `lib/gitlab.js` | Single-project fetch, paginated group fetch, date filtering, early-stop on old data, incomplete job filtering, 429 retry, error throwing |
| `lib/report.js` | Markdown structure and sections, table row correctness, locale number formatting, CLI stdout output |
