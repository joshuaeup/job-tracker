import { ScoredJob } from "../types/index.js";

interface ResendEmailRequest {
  from: string;
  to: string;
  subject: string;
  text: string;
}

function buildDigest(date: string, scoredJobs: ScoredJob[]): string {
  if (scoredJobs.length === 0) {
    return `Job Search Run — ${date}\n\n0 new roles found. Pipeline completed successfully.`;
  }

  const lines = [
    `Job Search Run — ${date}`,
    `${scoredJobs.length} new role(s) found`,
    "",
  ];

  for (const { job, evaluation } of scoredJobs) {
    lines.push(`${job.company} — ${job.title} (${job.location})`);
    lines.push(`Score: ${evaluation.fitScore}/100 | ${evaluation.recommendation}`);
    lines.push(evaluation.summary);
    lines.push(job.url);
    lines.push("");
  }

  return lines.join("\n").trim();
}

export async function sendEmailDigest(
  resendApiKey: string,
  toEmail: string,
  date: string,
  scoredJobs: ScoredJob[]
): Promise<void> {
  const text = buildDigest(date, scoredJobs);
  const subject = `Job Search Digest — ${date} (${scoredJobs.length} new role${scoredJobs.length !== 1 ? "s" : ""})`;

  const payload: ResendEmailRequest = {
    from: "noreply@resend.dev",
    to: toEmail,
    subject,
    text,
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend email failed: ${response.status} ${errorText}`);
  }
}
