# Technical Specification — Job Search Automation Pipeline

> Build target document for Claude Code. Contains directory structure, module contracts, data schemas, external API patterns, and implementation constraints.

> [!IMPORTANT]
> This document is the single source of truth for how the pipeline should be built. Treat every interface, schema, and file path as a contract. Do not deviate from module boundaries or data shapes without explicit instruction.

---

## 1. Repository Structure

The project is a single TypeScript Node.js package with no frontend. All source lives under `src/` with clear module separation.

```
job-search-automation/
├── .github/
│   └── workflows/
│       └── job-search.yml          # Cron trigger + env injection
├── src/
│   ├── index.ts                    # Entrypoint — orchestrates pipeline stages
│   ├── config/
│   │   ├── companies.json          # Target company list
│   │   └── target-role-profile.ts  # Fit criteria constants
│   ├── fetchers/
│   │   ├── greenhouse.ts           # Greenhouse ATS fetcher
│   │   ├── lever.ts                # Lever ATS fetcher
│   │   ├── ashby.ts                # Ashby ATS fetcher
│   │   └── index.ts                # Fetcher registry + runner
│   ├── normalizer/
│   │   └── index.ts                # Normalize ATS output to NormalizedJob
│   ├── filter/
│   │   └── index.ts                # Apply title/location/stack filters
│   ├── dedup/
│   │   └── notion.ts               # Query Notion for existing job URLs
│   ├── evaluator/
│   │   ├── claude.ts               # Claude API call + response parse
│   │   └── prompt.ts               # Prompt builder — injects role profile
│   ├── logger/
│   │   └── notion.ts               # Write qualifying roles to Notion DB
│   ├── notify/
│   │   ├── slack.ts                # Slack webhook digest sender
│   │   └── email.ts                # Resend email digest sender
│   └── types/
│       └── index.ts                # Shared TypeScript types
├── package.json
├── tsconfig.json
└── README.md
```

---

## 2. Core TypeScript Types

All modules must import from `src/types/index.ts`. Do not define local types that duplicate these shapes.

### `CompanyConfig` — companies.json entry

```typescript
interface CompanyConfig {
  name: string; // Display name, e.g. 'Stripe'
  ats: "greenhouse" | "lever" | "ashby";
  slug: string; // ATS board slug, e.g. 'stripe'
  enabled: boolean; // Toggle without removing from config
}
```

### `RawJob` — ATS fetcher output (before normalization)

```typescript
interface RawJob {
  source: "greenhouse" | "lever" | "ashby";
  company: string;
  raw: Record<string, unknown>; // Untouched ATS response object
}
```

### `NormalizedJob` — normalizer output

```typescript
interface NormalizedJob {
  id: string; // Stable unique ID: '{ats}:{company}:{ats_job_id}'
  title: string;
  company: string;
  location: string; // Raw location string from ATS
  remote: boolean; // true if location contains 'remote' (case-insensitive)
  url: string; // Direct link to job posting
  department: string;
  ats: "greenhouse" | "lever" | "ashby";
  postedAt: string | null; // ISO 8601 if available
  salaryMin: number | null; // USD, if listed in posting
  salaryMax: number | null;
  descriptionText: string; // Plain text, stripped of HTML
}
```

### `EvaluationResult` — Claude evaluator output

```typescript
interface EvaluationResult {
  fitScore: number; // 0–100
  recommendation: "apply" | "research" | "skip";
  summary: string; // 2–3 sentence plain-language assessment
  flags: string[]; // e.g. ['No TypeScript', 'Below salary floor']
}
```

### `ScoredJob` — post-evaluation

```typescript
interface ScoredJob {
  job: NormalizedJob;
  evaluation: EvaluationResult;
}
```

---

## 3. ATS Fetcher Contracts

Each fetcher is a default exported async function that takes a `CompanyConfig` and returns `RawJob[]`. Fetchers must not perform normalization — return the raw ATS response wrapped in the `RawJob` envelope.

> [!NOTE]
> All fetchers must handle HTTP errors gracefully. A failed fetch for one company must log the error and continue — it must not abort the pipeline. Use `try/catch` per company, not per batch.

### Greenhouse

```
Endpoint: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
Response:  { jobs: Array<{ id, title, location, departments, absolute_url, ... }> }
Note:      Use ?content=true to include job description HTML in the response
Envelope:  { source: 'greenhouse', company: config.name, raw: item }
```

### Lever

```
Endpoint: https://api.lever.co/v0/postings/{slug}?mode=json
Response:  Array<{ id, text, categories, descriptionPlain, hostedUrl, ... }>
Envelope:  { source: 'lever', company: config.name, raw: item }
```

### Ashby

```
Endpoint: https://api.ashbyhq.com/posting-api/job-board/{slug}
Response:  { jobPostings: Array<{ id, title, location, jobUrl, ... }> }
Envelope:  { source: 'ashby', company: config.name, raw: item }
```

---

## 4. Normalizer

The normalizer takes `RawJob[]` and returns `NormalizedJob[]`. It maps each ATS-specific field shape to the common `NormalizedJob` schema. Branch on `raw.source` to apply the correct field mappings.

| Field                     | Mapping Rule                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `id`                      | `'{ats}:{company_slug}:{job_id}'` — all lowercase, spaces replaced with hyphens                        |
| `title`                   | Direct from ATS title field                                                                            |
| `location`                | Direct from ATS location field (string or object — handle both)                                        |
| `remote`                  | `true` if location string contains `'remote'` (case-insensitive) OR if ATS has an explicit remote flag |
| `url`                     | Greenhouse: `absolute_url`. Lever: `hostedUrl`. Ashby: `jobUrl`                                        |
| `department`              | First entry of departments array, or empty string                                                      |
| `descriptionText`         | Strip HTML tags from description field using regex or `html-to-text` library                           |
| `salaryMin` / `salaryMax` | Parse from compensation field if present, otherwise `null`                                             |

---

## 5. Filter Module

The filter module takes `NormalizedJob[]` and returns `NormalizedJob[]` — the subset that passes all configured criteria. Filtering is additive: a job must pass **all** active filters to proceed.

> [!IMPORTANT]
> The filter is intentionally permissive. Its job is to remove obvious mismatches (intern roles, unrelated departments), not to do precision screening. That is the evaluator's job. When in doubt, let a role through to Claude.

### Title filter

Case-insensitive match against a keywords allowlist. A role passes if its title contains at least one keyword. Default keywords:

- `backend`, `back-end`, `back end`
- `software engineer`, `software developer`
- `node`, `nodejs`, `node.js`
- `typescript`, `api`, `platform`
- `tech lead`, `staff engineer` — flag for manual review, do not auto-skip

### Location filter

Pass if: `remote === true` OR location string contains `'Charlotte'` OR location string contains `'Remote'`. Roles with no location data pass by default (let Claude evaluate).

### Seniority filter

Exclude roles where the title clearly indicates a mismatch. Excluded title keywords: `intern`, `junior`, `jr.`, `associate`, `principal`, `distinguished`, `vp of`. Titles containing `staff` are **flagged**, not excluded.

---

## 6. Deduplication

The dedup module determines whether a role has already been seen by querying the Notion Job Tracker. A role is considered seen if any existing Notion row has a matching `Job Posting URL`.

### Strategy — bulk prefetch, not per-role query

Do **not** query Notion one role at a time. At the start of each run, fetch all existing job URLs from Notion into a `Set<string>`, then do O(1) lookups per role. Respect Notion's 3 req/sec rate limit with a 400ms delay between paginated list calls.

### Notion query pattern (for individual lookups if needed)

```
POST https://api.notion.com/v1/databases/{DATABASE_ID}/query
{
  "filter": {
    "property": "Job Posting URL",
    "url": { "equals": "<job.url>" }
  }
}

// results.length > 0  →  skip (already seen)
// results.length === 0  →  new role, proceed
```

---

## 7. Claude Evaluator

The evaluator module sends each new `NormalizedJob` to the Anthropic API and parses the structured response. It must return `EvaluationResult` or throw a typed error if the response cannot be parsed.

> [!WARNING]
> Add a 500ms delay between Claude API calls. Do not parallelize Claude calls — evaluate sequentially.

### Model and parameters

```
model:       claude-sonnet-4-6
max_tokens:  600
temperature: 0   // Deterministic evaluation
```

### System prompt structure

The system prompt must include the following sections in order:

1. **Role** — `You are a precise job fit evaluator. Return only valid JSON. No preamble, no explanation, no markdown.`
2. **Candidate profile** — inject the full contents of `target-role-profile.ts` as structured text
3. **Output schema** — define the exact JSON shape Claude must return (`EvaluationResult`)
4. **Scoring guidance** — define what 70+, 50–69, and below 50 mean in terms of recommendation

### User message structure

```
Job Title:   {job.title}
Company:     {job.company}
Location:    {job.location} (Remote: {job.remote})
Department:  {job.department}
Salary:      {job.salaryMin}–{job.salaryMax} (null if not listed)

Description:
{job.descriptionText.slice(0, 2000)}   // Cap at 2000 chars to control token cost
```

### Response parsing

Parse the response as JSON. If `JSON.parse` fails, retry once. If it fails twice, log the raw response and return a default `EvaluationResult`:

```typescript
{
  fitScore: 0,
  recommendation: 'skip',
  summary: 'Parse error — manual review required',
  flags: ['evaluation_failed']
}
```

---

## 8. Notion Logger

The logger module creates a new page in the Job Tracker Notion database for each qualifying `ScoredJob`. A role qualifies if `evaluation.recommendation` is `'apply'` or `'research'`.

> [!NOTE]
> Notion database ID: `39607570a8db407885c26514e2593780`
> Parent for new pages: `ad5faa22-a9ee-4d44-9611-fab9c626b08d`
> These are injected via the `NOTION_DATABASE_ID` environment variable — do not hardcode.

### Notion page properties to set

| Property Name             | Value                                                                            |
| ------------------------- | -------------------------------------------------------------------------------- |
| Company                   | `rich_text` — `job.company`                                                      |
| Role Title _(page title)_ | `title` — `job.title`                                                            |
| Status                    | `select` — `'Researching'`                                                       |
| Fit Score                 | `select` — `'🎯 Strong Fit'` if score ≥ 85, `'✅ Good Fit'` if score ≥ 70        |
| Location                  | `rich_text` — `job.location`                                                     |
| Salary Range              | `rich_text` — formatted range string, or `'Not listed'`                          |
| Date Applied              | `date` — leave `null` (manual entry)                                             |
| Job Posting URL           | `url` — `job.url`                                                                |
| Next Step                 | `rich_text` — leave empty (manual entry)                                         |
| Notes                     | `rich_text` — `evaluation.summary + '\n\nFlags: ' + evaluation.flags.join(', ')` |

---

## 9. Notification / Daily Digest

After the logging stage, the notify module sends a digest of new roles found in the run. If no qualifying roles were found, send a brief confirmation that the run completed with zero results.

### Digest message format

```
*Job Search Run — {date}*
{count} new role(s) found

• {company} — {title} ({location})
  Score: {fitScore}/100 | {recommendation}
  {summary}
  {url}

(repeat for each qualifying role)
```

### Slack

`POST` to `SLACK_WEBHOOK_URL` with `Content-Type: application/json` and body `{ "text": digestMessage }`. If `SLACK_WEBHOOK_URL` is not set, skip silently.

### Email (Resend)

If `RESEND_API_KEY` is set, send digest as a plain-text email.

```
From:    noreply@resend.dev
To:      process.env.NOTIFY_EMAIL
Subject: Job Search Digest — {date} ({count} new roles)
Body:    digestMessage (plain text)
```

---

## 10. GitHub Actions Workflow

```yaml
# .github/workflows/job-search.yml

name: Job Search Automation

on:
  schedule:
    - cron: "0 13 * * 1-5" # 9am ET, weekdays only
  workflow_dispatch: # Manual trigger for testing

jobs:
  run-pipeline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run build
      - run: npm start
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          NOTION_DATABASE_ID: ${{ secrets.NOTION_DATABASE_ID }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          NOTIFY_EMAIL: ${{ secrets.NOTIFY_EMAIL }}
          FIT_SCORE_THRESHOLD: "60"
```

---

## 11. `companies.json` — Starter Config

Place at `src/config/companies.json`. Set `enabled: false` to pause a company without deleting it.

```json
[
  { "name": "Stripe", "ats": "greenhouse", "slug": "stripe", "enabled": true },
  { "name": "Plaid", "ats": "greenhouse", "slug": "plaid", "enabled": true },
  { "name": "Affirm", "ats": "greenhouse", "slug": "affirm", "enabled": true },
  {
    "name": "NerdWallet",
    "ats": "greenhouse",
    "slug": "nerdwallet",
    "enabled": true
  },
  { "name": "SeatGeek", "ats": "lever", "slug": "seatgeek", "enabled": true },
  {
    "name": "Betterment",
    "ats": "greenhouse",
    "slug": "betterment",
    "enabled": true
  },
  { "name": "Notion", "ats": "ashby", "slug": "notion", "enabled": true },
  { "name": "Cribl", "ats": "greenhouse", "slug": "cribl", "enabled": true }
]
```

---

## 12. Implementation Constraints

These rules are non-negotiable and must be followed throughout the build:

- **TypeScript strict mode** must be enabled. No implicit `any`. No non-null assertions without justification.
- **Native fetch only** — use the Node.js 20+ built-in `fetch`. No Axios, Got, or other HTTP libraries.
- **Explicit error handling** — every async function returns a `Result` type or throws a typed error. No swallowed promises.
- **No secrets in source** — all credentials come from environment variables. No `.env` files committed.
- **Notion API version header** — all requests must include `Notion-Version: 2022-06-28`.
- **Rate limits are mandatory** — 400ms delay between Notion write calls, 500ms delay between Claude calls. These are not optional.
- **Idempotent by design** — running the pipeline twice in one day must not create duplicate Notion rows.
- **Structured logging** — all `console.log` output must include a stage prefix: `[FETCH]`, `[FILTER]`, `[DEDUP]`, `[EVAL]`, `[LOG]`, `[NOTIFY]`.
- **Run summary** — `src/index.ts` must log a completion summary: total fetched, filtered, deduplicated, evaluated, logged, and skipped.
- **Graceful degradation** — a failed fetch for one company logs the error and continues. It never aborts the full run.

---

## 13. `package.json` Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@notionhq/client": "^2.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^20.x",
    "ts-node": "^10.x"
  }
}
```

> [!NOTE]
> `@notionhq/client` is the only approved third-party dependency. All other integrations (Claude API, Slack, Resend) use native `fetch`. Do not add additional npm packages without explicit instruction.
