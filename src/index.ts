import "dotenv/config";
import { Client } from "@notionhq/client";
import companies from "./config/companies.json" with { type: "json" };
import type {
  CompanyConfig,
  NormalizedJob,
  RawJob,
  // TODO: restore ScoredJob when Claude evaluation is re-enabled
  // ScoredJob,
  RunSummary,
} from "./types/index.js";
import { createLogger } from "./lib/logger.js";
import { fetchAll } from "./fetchers/index.js";
import { normalize } from "./normalizer/index.js";
import { filter } from "./filter/index.js";
import { fetchSeenUrls, deduplicate } from "./dedup/notion.js";
import { logRawJobsToNotion } from "./logger/notion.js";
import { sendReviewDigest } from "./notify/slack.js";

// TODO: Re-enable these imports once an Anthropic API key is available and
// pay-per-token usage is set up. The evaluate + log stages are fully built
// but bypassed until then.
// import { evaluate } from "./evaluator/claude.js";
// import { logAllToNotion } from "./logger/notion.js";
// import { sendSlackDigest } from "./notify/slack.js";

// ── Environment helpers ───────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getEnv(name: string): string | undefined {
  return process.env[name] ?? undefined;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Pipeline stages ───────────────────────────────────────────────────────────

/**
 * Stage 1 — Fetch raw job listings from all enabled ATS sources.
 * Failures for individual companies are logged and skipped.
 */
async function runFetch(): Promise<RawJob[]> {
  return fetchAll(companies as CompanyConfig[]);
}

/**
 * Stage 2 — Normalize raw ATS responses to a common schema and apply
 * title, location, and seniority filters. Returns only jobs that pass
 * all filters, along with counts for the run summary.
 */
function runNormalizeAndFilter(rawJobs: RawJob[]): {
  filtered: NormalizedJob[];
  fetchedCount: number;
  filteredCount: number;
} {
  const log = createLogger("FILTER");

  const normalized = normalize(rawJobs);
  log.info(`Normalized: ${normalized.length} jobs`);

  const filtered = filter(normalized);
  log.info(`After filter: ${filtered.length} jobs`);

  return {
    filtered,
    fetchedCount: normalized.length,
    filteredCount: filtered.length,
  };
}

/**
 * Stage 3 — Deduplicate filtered jobs against existing Notion rows.
 * Prefetches all known job URLs into a Set for O(1) per-job lookup,
 * then returns only jobs not already present in the tracker.
 */
async function runDedup(
  notion: Client,
  databaseId: string,
  jobs: NormalizedJob[],
): Promise<NormalizedJob[]> {
  const log = createLogger("DEDUP");

  log.info("Prefetching existing URLs from Notion...");
  const seenUrls = await fetchSeenUrls(notion, databaseId);
  log.info(`Known URLs in Notion: ${seenUrls.size}`);

  const newJobs = deduplicate(jobs, seenUrls);
  log.info(`New roles for review: ${newJobs.length}`);

  return newJobs;
}

// TODO: Re-enable runEvaluate once the Anthropic API key is configured.
// This stage sends each new role to Claude Sonnet for fit scoring against
// the Target Role Profile in src/config/target-role-profile.ts, returning
// a fitScore (0-100), recommendation (apply/research/skip), summary, and flags.
// Requires: ANTHROPIC_API_KEY env var + pay-per-token billing set up at
// console.anthropic.com.
//
// async function runEvaluate(
//   jobs: NormalizedJob[],
//   apiKey: string,
//   fitScoreThreshold: number,
// ): Promise<{
//   scoredJobs: ScoredJob[];
//   qualifying: ScoredJob[];
//   skippedCount: number;
// }> {
//   const log = createLogger("EVAL");
//   log.info(`Evaluating ${jobs.length} roles with Claude...`);
//
//   const scoredJobs: ScoredJob[] = [];
//   let index = 0;
//
//   for (const job of jobs) {
//     log.info(`(${index + 1}/${jobs.length}) "${job.title}" at ${job.company}`);
//     const evaluation = await evaluate(job, apiKey, index > 0);
//     log.info(`Score: ${evaluation.fitScore}/100 — ${evaluation.recommendation}`);
//     scoredJobs.push({ job, evaluation });
//     index++;
//   }
//
//   const qualifying = scoredJobs.filter(
//     (s) =>
//       s.evaluation.recommendation !== "skip" &&
//       s.evaluation.fitScore >= fitScoreThreshold,
//   );
//
//   return {
//     scoredJobs,
//     qualifying,
//     skippedCount: scoredJobs.length - qualifying.length,
//   };
// }

// TODO: Re-enable runLog once Claude evaluation is active.
// Writes qualifying ScoredJobs to the Notion Job Tracker database,
// pre-populating Company, Role Title, Status, Fit Score, Location,
// Salary Range, Job Posting URL, and Notes (Claude summary + flags).
//
// async function runLog(
//   notion: Client,
//   databaseId: string,
//   qualifying: ScoredJob[],
// ): Promise<number> {
//   const log = createLogger("LOG");
//   log.info(`Logging ${qualifying.length} qualifying roles to Notion...`);
//   return logAllToNotion(notion, databaseId, qualifying);
// }

/**
 * Stage 4 (manual review mode) — Post all new deduped roles to Slack so
 * they can be reviewed manually. Skipped if SLACK_WEBHOOK_URL is not set.
 *
 * TODO: Replace this with runNotify(qualifying, date) once Claude evaluation
 * is re-enabled. That version sends only scored qualifying roles using
 * sendSlackDigest() and includes fit score, recommendation, and summary.
 */
async function runReviewNotify(
  jobs: NormalizedJob[],
  date: string,
): Promise<void> {
  const log = createLogger("NOTIFY");

  const slackWebhook = getEnv("SLACK_WEBHOOK_URL");
  if (!slackWebhook) {
    log.info("SLACK_WEBHOOK_URL not set — skipping notification");
    return;
  }

  try {
    await sendReviewDigest(slackWebhook, date, jobs);
    log.info(`Slack review digest sent — ${jobs.length} role(s)`);
  } catch (err: unknown) {
    log.error("Slack send failed", err);
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const log = createLogger("PIPELINE");

  log.info(`Starting job search pipeline — ${today()}`);

  // TODO: Remove ANTHROPIC_API_KEY from required env vars once evaluation
  // is re-enabled. Not needed while Claude stage is commented out.
  const notionToken = requireEnv("NOTION_TOKEN");
  const notionDatabaseId = requireEnv("NOTION_DATABASE_ID");

  const notion = new Client({ auth: notionToken });
  const summary: RunSummary = {
    fetched: 0,
    filtered: 0,
    deduplicated: 0,
    evaluated: 0,
    logged: 0,
    skipped: 0,
  };

  const rawJobs = await runFetch();

  const { filtered, fetchedCount, filteredCount } =
    runNormalizeAndFilter(rawJobs);
  summary.fetched = fetchedCount;
  summary.filtered = filteredCount;

  const newJobs = await runDedup(notion, notionDatabaseId, filtered);
  summary.deduplicated = newJobs.length;

  if (newJobs.length === 0) {
    log.info("No new roles found. Exiting.");
    printSummary(summary);
    return;
  }

  // TODO: Swap these two blocks when re-enabling Claude evaluation:
  //
  // const { scoredJobs, qualifying, skippedCount } = await runEvaluate(
  //   newJobs,
  //   requireEnv("ANTHROPIC_API_KEY"),
  //   parseInt(getEnv("FIT_SCORE_THRESHOLD") ?? "60", 10),
  // );
  // summary.evaluated = scoredJobs.length;
  // summary.skipped = skippedCount;
  // summary.logged = await runLog(notion, notionDatabaseId, qualifying);
  // await runNotify(qualifying, today());

  await logRawJobsToNotion(notion, notionDatabaseId, newJobs);

  await runReviewNotify(newJobs, today());

  printSummary(summary);
}

// ── Output ────────────────────────────────────────────────────────────────────

function printSummary(summary: RunSummary): void {
  console.log("");
  console.log("  ┌─────────────────────────────────────┐");
  console.log("  │         Pipeline Run Summary         │");
  console.log("  ├─────────────────────────────────────┤");
  console.log(`  │  Fetched        ${String(summary.fetched).padStart(20)} │`);
  console.log(`  │  Filtered       ${String(summary.filtered).padStart(20)} │`);
  console.log(
    `  │  New (deduped)  ${String(summary.deduplicated).padStart(20)} │`,
  );
  console.log(
    `  │  Sent to Slack  ${String(summary.deduplicated).padStart(20)} │`,
  );
  console.log("  └─────────────────────────────────────┘");
  console.log("");
}

run().catch((err: unknown) => {
  createLogger("PIPELINE").error("Fatal error", err);
  process.exit(1);
});
