# Job Search Automation — Project Overview

> A Claude-powered pipeline that monitors ATS job boards, evaluates role fit, and surfaces new opportunities into a Notion tracker — automatically.

---

## At a Glance

|                 |                                 |
| --------------- | ------------------------------- |
| **Cadence**     | Runs daily on a schedule        |
| **ATS Sources** | Greenhouse · Lever · Ashby      |
| **AI Layer**    | Claude API — fit evaluation     |
| **State Store** | Notion — single source of truth |

---

## 1. What This Is

This project automates the most repetitive part of a structured job search: monitoring company career pages, identifying new roles that match a target profile, and routing them into a tracking system for review.

Without automation, this process requires manually checking dozens of company career pages every few days, cross-referencing against a set of criteria (stack, seniority, remote, salary), and then manually logging anything interesting into a tracker. The automation does all of that on a schedule, leaving only the high-judgment work — deciding whether to apply — to the human.

The system is not a job board scraper. It targets specific companies via their ATS APIs (Greenhouse, Lever, Ashby), which are public, structured, and reliable. Each discovered role passes through a Claude-powered evaluation layer that applies the same fit criteria used in manual screening.

---

## 2. Problem It Solves

| Pain Point             | Description                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Manual monitoring      | Checking 30–50 career pages every few days is time-consuming and easy to let slip    |
| Inconsistent screening | Manual evaluation of fit is subjective and varies based on energy and attention      |
| Missed roles           | New postings can go unnoticed for days, reducing the window to be an early applicant |
| Duplicate review       | Without a seen-jobs record, the same role gets re-evaluated across sessions          |
| Tracker friction       | Manually creating Notion rows for every interesting role adds friction to logging    |

---

## 3. How It Works

The pipeline runs as a GitHub Actions workflow on a daily schedule. Each run executes five sequential stages:

1. **Fetch** — Pull job listings from configured company slugs across Greenhouse, Lever, and Ashby ATS APIs
2. **Filter** — Normalize to a common schema and apply keyword/location/seniority filters
3. **Deduplicate** — Query the Notion Job Tracker to skip any role already logged or previously seen
4. **Evaluate** — Send new roles to Claude with the Target Role Profile as context; receive a fit score, summary, and recommendation
5. **Log** — Write qualifying roles as new Notion rows with status `Researching`, fit score, and a one-line summary

At the end of each run, a daily digest is sent via Slack webhook or email listing all new roles surfaced. The next morning review is simply opening Notion and reading through what was found.

---

## 4. Technology Stack

| Layer               | Technology                                        |
| ------------------- | ------------------------------------------------- |
| Runtime             | Node.js 20+ with TypeScript                       |
| Scheduler           | GitHub Actions (cron trigger, free tier)          |
| ATS sources         | Greenhouse, Lever, Ashby public job board APIs    |
| AI evaluation       | Anthropic Claude API (`claude-sonnet-4-6`)        |
| State / dedup store | Notion API (existing Job Tracker DB)              |
| Notifications       | Slack Incoming Webhooks or Resend (email)         |
| Configuration       | JSON company list + environment secrets in GitHub |
| Language            | TypeScript (strict mode)                          |

---

## 5. What You Configure

The system is driven by two inputs: a companies config file and a set of secrets. No hardcoded logic.

### `companies.json` — target company list

A JSON array where each entry specifies a company name, its ATS platform, and its slug. New companies are added in one line.

### GitHub Actions Secrets — credentials

| Secret                | Required | Description                                 |
| --------------------- | -------- | ------------------------------------------- |
| `ANTHROPIC_API_KEY`   | ✅       | Your Claude API key                         |
| `NOTION_TOKEN`        | ✅       | Your Notion integration token               |
| `NOTION_DATABASE_ID`  | ✅       | Your Job Tracker DB ID                      |
| `SLACK_WEBHOOK_URL`   | optional | For daily digest notifications              |
| `RESEND_API_KEY`      | optional | For email digest instead of Slack           |
| `NOTIFY_EMAIL`        | optional | Recipient address for email digest          |
| `FIT_SCORE_THRESHOLD` | optional | Minimum score to log a role (default: `60`) |

---

## 6. Fit Evaluation Logic

The Claude evaluator receives each job posting alongside a structured prompt containing the Target Role Profile: preferred stack, salary floor, seniority target, remote requirements, and red/amber/green flag criteria. It returns a structured JSON response with four fields:

| Field            | Description                                            |
| ---------------- | ------------------------------------------------------ |
| `fitScore`       | 0–100 percentage match against the Target Role Profile |
| `recommendation` | One of: `apply`, `research`, or `skip`                 |
| `summary`        | 2–3 sentence plain-language assessment of the role     |
| `flags`          | Array of specific red/amber/green flags triggered      |

Roles with a `fitScore` below the configured threshold (default: `60`) are logged as skipped and excluded from the daily digest. Roles above threshold are written to Notion with their full evaluation attached.

---

## 7. What Gets Written to Notion

Each new qualifying role creates a Notion row with the following fields populated automatically:

| Field           | Source                       | Notion Type                        |
| --------------- | ---------------------------- | ---------------------------------- |
| Company         | From `companies.json` config | Text                               |
| Role Title      | From ATS posting             | Title                              |
| Status          | Set to `Researching`         | Select                             |
| Fit Score       | Claude evaluation result     | Select (`Strong Fit` / `Good Fit`) |
| Location        | From ATS posting             | Text                               |
| Job Posting URL | Direct link to the posting   | URL                                |
| Date Applied    | Left blank for manual entry  | Date                               |
| Notes           | Claude summary + flags       | Text                               |
| Next Step       | Left blank for manual entry  | Text                               |

---

## 8. Scope and Constraints

- Only targets companies using Greenhouse, Lever, or Ashby — does not scrape arbitrary career pages or LinkedIn
- Does not auto-apply — the system surfaces roles for human review, not submit applications
- Does not handle authentication-gated job boards — all ATS endpoints used are public
- Fit evaluation is a signal, not a decision — the recommendation is advisory, not prescriptive
- Companies must be manually added to `companies.json` — the system does not discover new companies autonomously

---

## 9. Cost to Run

| Service        | Est. Monthly Cost                                            |
| -------------- | ------------------------------------------------------------ |
| GitHub Actions | Free — daily runs ~5 min each = ~150 min/month of 2,000 free |
| Anthropic API  | ~$1–2 — Claude Sonnet 4, ~30 evaluations/day                 |
| Notion API     | Free — rate limits respected with built-in delays            |
| Slack webhooks | Free                                                         |
| Resend (email) | Free — 30 emails/month of 3,000 free tier                    |

**Total: ~$1–2/month.**
