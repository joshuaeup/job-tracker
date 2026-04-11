import type { ScoredJob } from "../types/index.js";

function buildDigest(date: string, scoredJobs: ScoredJob[]): string {
  if (scoredJobs.length === 0) {
    return `*Job Search Run — ${date}*\n0 new roles found. Pipeline completed successfully.`;
  }

  const lines = [
    `*Job Search Run — ${date}*`,
    `${scoredJobs.length} new role(s) found`,
    "",
  ];

  for (const { job, evaluation } of scoredJobs) {
    lines.push(`• *${job.company}* — ${job.title} (${job.location})`);
    lines.push(`  Score: ${evaluation.fitScore}/100 | ${evaluation.recommendation}`);
    lines.push(`  ${evaluation.summary}`);
    lines.push(`  ${job.url}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * Posts a daily digest of new qualifying roles to a Slack incoming webhook.
 * If no qualifying roles were found, sends a brief completion confirmation.
 *
 * @throws {Error} If the webhook POST returns a non-OK status.
 */
export async function sendSlackDigest(
  webhookUrl: string,
  date: string,
  scoredJobs: ScoredJob[]
): Promise<void> {
  const text = buildDigest(date, scoredJobs);

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
