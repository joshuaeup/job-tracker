import type { NormalizedJob, ScoredJob } from "../types/index.js";

// ── Manual review digest (active) ────────────────────────────────────────────

function formatSalary(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  }
  if (min !== null) return `$${min.toLocaleString()}+`;
  return "Not listed";
}

function buildReviewDigest(date: string, jobs: NormalizedJob[]): string {
  if (jobs.length === 0) {
    return `*Job Search Run — ${date}*\nNo new roles found after filtering and deduplication.`;
  }

  const lines = [
    `*🔍 Job Search Run — ${date}*`,
    `*${jobs.length} new role(s) passed filters — manual review needed*`,
    "",
  ];

  for (const job of jobs) {
    const salary = formatSalary(job.salaryMin, job.salaryMax);
    const remote = job.remote ? "Remote" : job.location;

    lines.push(`*${job.company}*`);
    lines.push(`>${job.title}`);
    lines.push(`>📍 ${remote}   💰 ${salary}`);
    lines.push(`><${job.url}|View posting>`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * Posts a manual review digest of all new filtered + deduped roles to Slack.
 * Used when Claude evaluation is disabled — the user reviews fit themselves.
 *
 * @throws {Error} If the webhook POST returns a non-OK status.
 */
export async function sendReviewDigest(
  webhookUrl: string,
  date: string,
  jobs: NormalizedJob[]
): Promise<void> {
  const text = buildReviewDigest(date, jobs);

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(
      `Slack webhook failed: ${response.status} ${response.statusText}`
    );
  }
}

// ── Claude-evaluated digest (used when evaluation is enabled) ─────────────────

function buildScoredDigest(date: string, scoredJobs: ScoredJob[]): string {
  if (scoredJobs.length === 0) {
    return `*Job Search Run — ${date}*\n0 qualifying roles found.`;
  }

  const lines = [
    `*Job Search Run — ${date}*`,
    `${scoredJobs.length} qualifying role(s) found`,
    "",
  ];

  for (const { job, evaluation } of scoredJobs) {
    lines.push(`*${job.company}* — ${job.title}`);
    lines.push(`>📍 ${job.location}   Score: ${evaluation.fitScore}/100 | ${evaluation.recommendation}`);
    lines.push(`>${evaluation.summary}`);
    lines.push(`><${job.url}|View posting>`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * Posts a digest of Claude-evaluated qualifying roles to Slack.
 * Only used when the Claude evaluation stage is active.
 *
 * @throws {Error} If the webhook POST returns a non-OK status.
 */
export async function sendSlackDigest(
  webhookUrl: string,
  date: string,
  scoredJobs: ScoredJob[]
): Promise<void> {
  const text = buildScoredDigest(date, scoredJobs);

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(
      `Slack webhook failed: ${response.status} ${response.statusText}`
    );
  }
}
