import { Client } from "@notionhq/client";
import companies from "./config/companies.json" with { type: "json" };
import type { CompanyConfig, NormalizedJob, ScoredJob, RunSummary } from "./types/index.js";
import { createLogger } from "./lib/logger.js";
import { fetchAll } from "./fetchers/index.js";
import { normalize } from "./normalizer/index.js";
import { filter } from "./filter/index.js";
import { fetchSeenUrls, deduplicate } from "./dedup/notion.js";
import { evaluate } from "./evaluator/claude.js";
import { logAllToNotion } from "./logger/notion.js";
import { sendSlackDigest } from "./notify/slack.js";
import { sendEmailDigest } from "./notify/email.js";

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

  // ── FETCH ────────────────────────────────────────────────────────────────────

  const rawJobs = await fetchAll(companies as CompanyConfig[]);

  // ── NORMALIZE + FILTER ───────────────────────────────────────────────────────

  const filterLog = createLogger("FILTER");

  const normalized: NormalizedJob[] = normalize(rawJobs);
  summary.fetched = normalized.length;
  filterLog.info(`Normalized: ${normalized.length} jobs`);

  const filtered: NormalizedJob[] = filter(normalized);
  summary.filtered = filtered.length;
  filterLog.info(`After filter: ${filtered.length} jobs`);

  // ── DEDUP ────────────────────────────────────────────────────────────────────

  const dedupLog = createLogger("DEDUP");

  dedupLog.info("Prefetching existing URLs from Notion...");
  const seenUrls = await fetchSeenUrls(notion, notionDatabaseId);
  dedupLog.info(`Known URLs in Notion: ${seenUrls.size}`);

  const newJobs = deduplicate(filtered, seenUrls);
  summary.deduplicated = newJobs.length;
  dedupLog.info(`New roles to evaluate: ${newJobs.length}`);

  if (newJobs.length === 0) {
    log.info("No new roles found. Exiting.");
    printSummary(summary);
    return;
  }

  // ── EVALUATE ─────────────────────────────────────────────────────────────────

  const evalLog = createLogger("EVAL");

  evalLog.info(`Evaluating ${newJobs.length} roles with Claude...`);

  const scoredJobs: ScoredJob[] = [];
  let evalIndex = 0;

  for (const job of newJobs) {
    evalLog.info(`(${evalIndex + 1}/${newJobs.length}) "${job.title}" at ${job.company}`);

    const evaluation = await evaluate(job, anthropicApiKey, evalIndex > 0);

    evalLog.info(`Score: ${evaluation.fitScore}/100 — ${evaluation.recommendation}`);
    scoredJobs.push({ job, evaluation });
    evalIndex++;
  }

  summary.evaluated = scoredJobs.length;

  const qualifying = scoredJobs.filter(
    (s) =>
      s.evaluation.recommendation !== "skip" &&
      s.evaluation.fitScore >= fitScoreThreshold
  );
  summary.skipped = scoredJobs.length - qualifying.length;

  // ── LOG ──────────────────────────────────────────────────────────────────────

  const logStageLog = createLogger("LOG");
  logStageLog.info(`Logging ${qualifying.length} qualifying roles to Notion...`);

  summary.logged = await logAllToNotion(notion, notionDatabaseId, qualifying);

  // ── NOTIFY ───────────────────────────────────────────────────────────────────

  const notifyLog = createLogger("NOTIFY");
  const date = today();
  const digestJobs = qualifying.filter(
    (s) =>
      s.evaluation.recommendation === "apply" ||
      s.evaluation.recommendation === "research"
  );

  const slackWebhook = getEnv("SLACK_WEBHOOK_URL");
  if (slackWebhook) {
    try {
      await sendSlackDigest(slackWebhook, date, digestJobs);
      notifyLog.info("Slack digest sent");
    } catch (err: unknown) {
      notifyLog.error("Slack send failed", err);
    }
  }

  const resendKey = getEnv("RESEND_API_KEY");
  const notifyEmail = getEnv("NOTIFY_EMAIL");
  if (resendKey && notifyEmail) {
    try {
      await sendEmailDigest(resendKey, notifyEmail, date, digestJobs);
      notifyLog.info("Email digest sent");
    } catch (err: unknown) {
      notifyLog.error("Email send failed", err);
    }
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────────

  printSummary(summary);
}

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
  const log = createLogger("PIPELINE");
  log.error("Fatal error", err);
  process.exit(1);
});
