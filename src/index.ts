import { Client } from "@notionhq/client";
import companies from "./config/companies.json" with { type: "json" };
import type { CompanyConfig, NormalizedJob, RawJob, ScoredJob, RunSummary } from "./types/index.js";
import { createLogger } from "./lib/logger.js";
import { fetchAll } from "./fetchers/index.js";
import { normalize } from "./normalizer/index.js";
import { filter } from "./filter/index.js";
import { fetchSeenUrls, deduplicate } from "./dedup/notion.js";
import { evaluate } from "./evaluator/claude.js";
import { logAllToNotion } from "./logger/notion.js";
import { sendSlackDigest } from "./notify/slack.js";
import { sendEmailDigest } from "./notify/email.js";

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
function runNormalizeAndFilter(
  rawJobs: RawJob[]
): { filtered: NormalizedJob[]; fetchedCount: number; filteredCount: number } {
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
  jobs: NormalizedJob[]
): Promise<NormalizedJob[]> {
  const log = createLogger("DEDUP");

  log.info("Prefetching existing URLs from Notion...");
  const seenUrls = await fetchSeenUrls(notion, databaseId);
  log.info(`Known URLs in Notion: ${seenUrls.size}`);

  const newJobs = deduplicate(jobs, seenUrls);
  log.info(`New roles to evaluate: ${newJobs.length}`);

  return newJobs;
}

/**
 * Stage 4 — Evaluate each new job with Claude against the Target Role Profile.
 * Calls are made sequentially with a 500ms delay between each to respect
 * the API rate limit. Returns all scored jobs and the subset that meet
 * the configured fit score threshold.
 */
async function runEvaluate(
  jobs: NormalizedJob[],
  apiKey: string,
  fitScoreThreshold: number
): Promise<{ scoredJobs: ScoredJob[]; qualifying: ScoredJob[]; skippedCount: number }> {
  const log = createLogger("EVAL");

  log.info(`Evaluating ${jobs.length} roles with Claude...`);

  const scoredJobs: ScoredJob[] = [];
  let index = 0;

  for (const job of jobs) {
    log.info(`(${index + 1}/${jobs.length}) "${job.title}" at ${job.company}`);

    const evaluation = await evaluate(job, apiKey, index > 0);

    log.info(`Score: ${evaluation.fitScore}/100 — ${evaluation.recommendation}`);
    scoredJobs.push({ job, evaluation });
    index++;
  }

  const qualifying = scoredJobs.filter(
    (s) =>
      s.evaluation.recommendation !== "skip" &&
      s.evaluation.fitScore >= fitScoreThreshold
  );

  return {
    scoredJobs,
    qualifying,
    skippedCount: scoredJobs.length - qualifying.length,
  };
}

/**
 * Stage 5 — Write all qualifying roles to the Notion Job Tracker database.
 * Only jobs with recommendation `apply` or `research` are logged.
 * Enforces a 400ms delay between writes to respect Notion's rate limit.
 *
 * @returns The number of rows successfully written.
 */
async function runLog(
  notion: Client,
  databaseId: string,
  qualifying: ScoredJob[]
): Promise<number> {
  const log = createLogger("LOG");

  log.info(`Logging ${qualifying.length} qualifying roles to Notion...`);

  return logAllToNotion(notion, databaseId, qualifying);
}

/**
 * Stage 6 — Send a daily digest of new qualifying roles via Slack and/or email.
 * Each channel is attempted independently — a failure on one does not
 * prevent the other from sending. Both are skipped if their credentials
 * are not configured.
 */
async function runNotify(qualifying: ScoredJob[], date: string): Promise<void> {
  const log = createLogger("NOTIFY");

  const digestJobs = qualifying.filter(
    (s) =>
      s.evaluation.recommendation === "apply" ||
      s.evaluation.recommendation === "research"
  );

  const slackWebhook = getEnv("SLACK_WEBHOOK_URL");
  if (slackWebhook) {
    try {
      await sendSlackDigest(slackWebhook, date, digestJobs);
      log.info("Slack digest sent");
    } catch (err: unknown) {
      log.error("Slack send failed", err);
    }
  }

  const resendKey = getEnv("RESEND_API_KEY");
  const notifyEmail = getEnv("NOTIFY_EMAIL");
  if (resendKey && notifyEmail) {
    try {
      await sendEmailDigest(resendKey, notifyEmail, date, digestJobs);
      log.info("Email digest sent");
    } catch (err: unknown) {
      log.error("Email send failed", err);
    }
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const log = createLogger("PIPELINE");

  log.info(`Starting job search pipeline — ${today()}`);

  const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY");
  const notionToken = requireEnv("NOTION_TOKEN");
  const notionDatabaseId = requireEnv("NOTION_DATABASE_ID");
  const fitScoreThreshold = parseInt(getEnv("FIT_SCORE_THRESHOLD") ?? "60", 10);

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

  const { filtered, fetchedCount, filteredCount } = runNormalizeAndFilter(rawJobs);
  summary.fetched = fetchedCount;
  summary.filtered = filteredCount;

  const newJobs = await runDedup(notion, notionDatabaseId, filtered);
  summary.deduplicated = newJobs.length;

  if (newJobs.length === 0) {
    log.info("No new roles found. Exiting.");
    printSummary(summary);
    return;
  }

  const { scoredJobs, qualifying, skippedCount } = await runEvaluate(
    newJobs,
    anthropicApiKey,
    fitScoreThreshold
  );
  summary.evaluated = scoredJobs.length;
  summary.skipped = skippedCount;

  summary.logged = await runLog(notion, notionDatabaseId, qualifying);

  await runNotify(qualifying, today());

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
  console.log(`  │  New (deduped)  ${String(summary.deduplicated).padStart(20)} │`);
  console.log(`  │  Evaluated      ${String(summary.evaluated).padStart(20)} │`);
  console.log(`  │  Logged         ${String(summary.logged).padStart(20)} │`);
  console.log(`  │  Skipped        ${String(summary.skipped).padStart(20)} │`);
  console.log("  └─────────────────────────────────────┘");
  console.log("");
}

run().catch((err: unknown) => {
  createLogger("PIPELINE").error("Fatal error", err);
  process.exit(1);
});
