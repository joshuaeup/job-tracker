# job-search-automation

> A Claude-powered pipeline that monitors ATS job boards daily, evaluates role fit against a structured profile, deduplicates against a Notion tracker, and surfaces new opportunities automatically.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Claude API](https://img.shields.io/badge/Claude-Sonnet_4-D97757?style=flat-square)](https://anthropic.com)
[![Notion API](https://img.shields.io/badge/Notion-API_2022--06--28-000000?style=flat-square&logo=notion&logoColor=white)](https://developers.notion.com/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-Scheduled-2088FF?style=flat-square&logo=github-actions&logoColor=white)](https://docs.github.com/en/actions)

---

## Overview

Manual job searching at scale is repetitive and inconsistent. This pipeline eliminates the mechanical parts:

- **Fetches** job listings daily from configured companies via Greenhouse, Lever, and Ashby ATS public APIs
- **Filters** by title keywords, location, and seniority before any AI evaluation occurs
- **Deduplicates** against an existing Notion Job Tracker — roles already logged are skipped
- **Evaluates** each new role with Claude using a structured Target Role Profile covering stack alignment, salary floor, remote requirements, and red/amber/green flag criteria
- **Logs** qualifying roles directly to Notion with fit score, summary, and flags pre-populated
- **Notifies** via Slack or email with a daily digest of what was found

The result: wake up each morning to a curated shortlist of new roles in Notion, already screened.

---

## Pipeline Architecture

```
GitHub Actions (cron: weekdays 9am ET)
        │
        ▼
┌─────────────────────────────────────────┐
│  FETCH                                  │
│  Greenhouse · Lever · Ashby             │
│  Per-company slug config in JSON        │
└────────────────────┬────────────────────┘
                     │  RawJob[]
                     ▼
┌─────────────────────────────────────────┐
│  NORMALIZE + FILTER                     │
│  Common schema · Title / location /     │
│  seniority keyword rules                │
└────────────────────┬────────────────────┘
                     │  NormalizedJob[]
                     ▼
┌─────────────────────────────────────────┐
│  DEDUPLICATE                            │
│  Bulk prefetch existing URLs from       │
│  Notion → O(1) Set lookup per role      │
└────────────────────┬────────────────────┘
                     │  New roles only
                     ▼
┌─────────────────────────────────────────┐
│  EVALUATE  (Claude Sonnet 4)            │
│  Fit score 0–100 · apply / research /   │
│  skip · summary · flags array           │
└────────────────────┬────────────────────┘
                     │  ScoredJob[]
                     ▼
┌─────────────────────────────────────────┐
│  LOG → Notion Job Tracker               │
│  Status: Researching · Fit score ·      │
│  Summary · URL · Flags pre-filled       │
└────────────────────┬────────────────────┘
                     │
                     ▼
        Daily digest → Slack / Email
```

---

## Project Structure

```
job-search-automation/
├── .github/
│   └── workflows/
│       └── job-search.yml       # Cron trigger + secret injection
├── src/
│   ├── index.ts                 # Entrypoint — orchestrates all stages
│   ├── config/
│   │   ├── companies.json       # Target company list (name, ats, slug, enabled)
│   │   └── target-role-profile.ts  # Fit criteria injected into Claude prompt
│   ├── fetchers/
│   │   ├── greenhouse.ts        # boards-api.greenhouse.io/v1/boards/{slug}/jobs
│   │   ├── lever.ts             # api.lever.co/v0/postings/{slug}?mode=json
│   │   ├── ashby.ts             # api.ashbyhq.com/posting-api/job-board/{slug}
│   │   └── index.ts             # Fetcher registry — runs all enabled companies
│   ├── normalizer/
│   │   └── index.ts             # Maps ATS-specific shapes → NormalizedJob
│   ├── filter/
│   │   └── index.ts             # Keyword, location, seniority filters
│   ├── dedup/
│   │   └── notion.ts            # Prefetch existing URLs → Set dedup
│   ├── evaluator/
│   │   ├── claude.ts            # Anthropic API call + JSON response parse
│   │   └── prompt.ts            # Builds system + user message from role profile
│   ├── logger/
│   │   └── notion.ts            # Creates Notion rows for qualifying roles
│   ├── notify/
│   │   ├── slack.ts             # Incoming webhook digest
│   │   └── email.ts             # Resend plain-text digest
│   └── types/
│       └── index.ts             # Shared interfaces: NormalizedJob, EvaluationResult, etc.
├── package.json
├── tsconfig.json
└── README.md
```

---

## Core Types

```typescript
interface NormalizedJob {
  id: string; // '{ats}:{company}:{job_id}'
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  department: string;
  ats: "greenhouse" | "lever" | "ashby";
  postedAt: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  descriptionText: string;
}

interface EvaluationResult {
  fitScore: number; // 0–100
  recommendation: "apply" | "research" | "skip";
  summary: string; // 2–3 sentence assessment
  flags: string[]; // e.g. ['No TypeScript', 'Below salary floor']
}
```

---

## Configuration

### `src/config/companies.json`

Add any company using Greenhouse, Lever, or Ashby. Toggle `enabled` to pause without deleting.

```json
[
  { "name": "Stripe", "ats": "greenhouse", "slug": "stripe", "enabled": true },
  { "name": "Plaid", "ats": "greenhouse", "slug": "plaid", "enabled": true },
  { "name": "Affirm", "ats": "greenhouse", "slug": "affirm", "enabled": true },
  { "name": "SeatGeek", "ats": "lever", "slug": "seatgeek", "enabled": true },
  { "name": "Notion", "ats": "ashby", "slug": "notion", "enabled": true },
  { "name": "Cribl", "ats": "greenhouse", "slug": "cribl", "enabled": true }
]
```

### GitHub Actions Secrets

| Secret                | Required | Description                             |
| --------------------- | -------- | --------------------------------------- |
| `ANTHROPIC_API_KEY`   | ✅       | Claude API key                          |
| `NOTION_TOKEN`        | ✅       | Notion integration token                |
| `NOTION_DATABASE_ID`  | ✅       | Job Tracker database ID                 |
| `SLACK_WEBHOOK_URL`   | optional | Slack incoming webhook for daily digest |
| `RESEND_API_KEY`      | optional | Resend API key for email digest         |
| `NOTIFY_EMAIL`        | optional | Recipient address for email digest      |
| `FIT_SCORE_THRESHOLD` | optional | Minimum score to log (default: `60`)    |

---

## Fit Evaluation

Each new role is evaluated by Claude against a structured Target Role Profile. The prompt includes preferred stack, salary floor, remote requirements, and explicit red/amber/green flag criteria. Claude returns structured JSON:

```json
{
  "fitScore": 82,
  "recommendation": "apply",
  "summary": "Strong TypeScript/Node.js backend role at a well-funded fintech. Remote-first, above salary floor. Primary gap is Kafka experience — not listed as required.",
  "flags": ["TypeScript ✅", "Remote ✅", "Salary unlisted ⚠️", "Kafka gap 🟡"]
}
```

Roles with `recommendation: skip` or `fitScore` below the configured threshold are recorded as seen but not written to Notion and excluded from the digest.

---

## Notion Integration

Each qualifying role creates a new Notion row with these fields pre-populated:

| Field           | Value                                        |
| --------------- | -------------------------------------------- |
| Title           | Job title from ATS                           |
| Company         | Company name                                 |
| Status          | `Researching`                                |
| Fit Score       | `🎯 Strong Fit` (≥85) or `✅ Good Fit` (≥70) |
| Location        | From ATS posting                             |
| Job Posting URL | Direct link                                  |
| Notes           | Claude summary + flags                       |
| Date Applied    | Left blank — manual entry                    |
| Next Step       | Left blank — manual entry                    |

The pipeline is **idempotent** — deduplication on `Job Posting URL` ensures running twice in one day produces no duplicate rows.

---

## Running Locally

```bash
# Install dependencies
npm install

# Set environment variables
export ANTHROPIC_API_KEY=...
export NOTION_TOKEN=...
export NOTION_DATABASE_ID=...

# Run the pipeline
npm run dev

# Type-check without running
npm run typecheck
```

---

## GitHub Actions Schedule

```yaml
on:
  schedule:
    - cron: "0 13 * * 1-5" # 9am ET, weekdays only
  workflow_dispatch: # Manual trigger for testing
```

Typical run: **< 5 minutes**. Well within GitHub Actions free tier (2,000 min/month on private repos).

---

## Stack

| Layer         | Choice                     | Reason                                     |
| ------------- | -------------------------- | ------------------------------------------ |
| Runtime       | Node.js 20+                | Native `fetch`, no dependencies for HTTP   |
| Language      | TypeScript (strict)        | Type safety across module boundaries       |
| Scheduler     | GitHub Actions             | Free, no infrastructure to manage          |
| AI            | Claude Sonnet 4            | Structured JSON output, reliable screening |
| State store   | Notion API                 | Existing tracker — no new service needed   |
| ATS sources   | Greenhouse / Lever / Ashby | Public APIs, no auth required              |
| Notifications | Slack webhooks / Resend    | Both free at job-search volume             |

No framework (Express, NestJS, etc.) — this is a short-lived batch script, not a server. Native Node.js is the right tool.

---

## Cost to Run

| Service        | Est. Monthly Cost                            |
| -------------- | -------------------------------------------- |
| GitHub Actions | Free (< 150 min/month of 2,000 free)         |
| Anthropic API  | ~$1–2 (Claude Sonnet 4, ~30 evaluations/day) |
| Notion API     | Free                                         |
| Slack webhooks | Free                                         |
| Resend         | Free (30 emails/month of 3,000 free)         |

**Total: ~$1–2/month.**

---

## Implementation Constraints

- **Strict TypeScript** — no implicit `any`, no non-null assertions without justification
- **Native fetch only** — no Axios, Got, or other HTTP libraries
- **Rate limits enforced** — 400ms between Notion writes, 500ms between Claude calls
- **No secrets in source** — all credentials via environment variables
- **Idempotent by design** — URL-based dedup prevents duplicate Notion rows
- **Graceful degradation** — a failed fetch for one company logs the error and continues; it never aborts the run
- **Structured logging** — all output prefixed with stage: `[FETCH]`, `[FILTER]`, `[DEDUP]`, `[EVAL]`, `[LOG]`, `[NOTIFY]`

---

_Built with [Claude Code](https://claude.ai/code) · Notion MCP integration · TypeScript_
