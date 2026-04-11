import { Client } from "@notionhq/client";
import companies from "./config/companies.json" with { type: "json" };
import { CompanyConfig, NormalizedJob, ScoredJob, RunSummary } from "./types/index.js";
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
  return process.env[name] || undefined;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function run(): Promise<void> {
  console.log(`[PIPELINE] Starting job search pipeline — ${today()}`);

  // Validate required env vars up front
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
  console.log("[FETCH] Fetching jobs from all enabled companies...");
  const rawJobs = await fetchAll(companies as CompanyConfig[]);

  // ── NORMALIZE + FILTER ───────────────────────────────────────────────────────
  const normalized: NormalizedJob[] = normalize(rawJobs);
  summary.fetched = normalized.length;
  console.log(`[FILTER] Normalized: ${normalized.length} jobs`);

  const filtered: NormalizedJob[] = filter(normalized);
  summary.filtered = filtered.length;
  console.log(`[FILTER] After filter: ${filtered.length} jobs`);

  // ── DEDUP ────────────────────────────────────────────────────────────────────
  console.log("[DEDUP] Prefetching existing URLs from Notion...");
  const seenUrls = await fetchSeenUrls(notion, notionDatabaseId);
  console.log(`[DEDUP] Known URLs: ${seenUrls.size}`);

  const newJobs = deduplicate(filtered, seenUrls);
  summary.deduplicated = newJobs.length;
  console.log(`[DEDUP] New roles to evaluate: ${newJobs.length}`);

  if (newJobs.length === 0) {
    console.log("[PIPELINE] No new roles found. Exiting.");
    printSummary(summary);
    return;
  }

  // ── EVALUATE ─────────────────────────────────────────────────────────────────
  console.log(`[EVAL] Evaluating ${newJobs.length} roles with Claude...`);
  const scoredJobs: ScoredJob[] = [];

  let evalIndex = 0;
  for (const job of newJobs) {
    console.log(
      `[EVAL] (${evalIndex + 1}/${newJobs.length}) Evaluating "${job.title}" at ${job.company}`
    );
    const evaluation = await evaluate(job, anthropicApiKey, evalIndex > 0);
    scoredJobs.push({ job, evaluation });
    console.log(
      `[EVAL] Score: ${evaluation.fitScore}/100 | ${evaluation.recommendation}`
    );
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
  console.log(`[LOG] Logging ${qualifying.length} qualifying roles to Notion...`);
  summary.logged = await logAllToNotion(notion, notionDatabaseId, qualifying);

  // ── NOTIFY ───────────────────────────────────────────────────────────────────
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
      console.log("[NOTIFY] Slack digest sent");
    } catch (err) {
      console.error(
        "[NOTIFY] Slack send failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const resendKey = getEnv("RESEND_API_KEY");
  const notifyEmail = getEnv("NOTIFY_EMAIL");
  if (resendKey && notifyEmail) {
    try {
      await sendEmailDigest(resendKey, notifyEmail, date, digestJobs);
      console.log("[NOTIFY] Email digest sent");
    } catch (err) {
      console.error(
        "[NOTIFY] Email send failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────────
  printSummary(summary);
}

function printSummary(summary: RunSummary): void {
  console.log("\n[PIPELINE] ── Run Summary ───────────────────");
  console.log(`  Fetched:       ${summary.fetched}`);
  console.log(`  Filtered:      ${summary.filtered}`);
  console.log(`  Deduplicated:  ${summary.deduplicated} (new)`);
  console.log(`  Evaluated:     ${summary.evaluated}`);
  console.log(`  Logged:        ${summary.logged}`);
  console.log(`  Skipped:       ${summary.skipped}`);
  console.log("[PIPELINE] ─────────────────────────────────\n");
}

run().catch((err) => {
  console.error("[PIPELINE] Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
