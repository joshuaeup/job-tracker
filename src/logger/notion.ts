import { Client } from "@notionhq/client";
import { ScoredJob } from "../types/index.js";

const NOTION_RATE_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fitScoreLabel(score: number): string {
  if (score >= 85) return "🎯 Strong Fit";
  if (score >= 70) return "✅ Good Fit";
  return "🔍 Possible Fit";
}

function formatSalary(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  }
  if (min !== null) return `$${min.toLocaleString()}+`;
  return "Not listed";
}

export async function logToNotion(
  notion: Client,
  databaseId: string,
  scoredJob: ScoredJob
): Promise<void> {
  const { job, evaluation } = scoredJob;
  const notes = `${evaluation.summary}\n\nFlags: ${evaluation.flags.join(", ")}`;

  await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      "Role Title": {
        title: [{ text: { content: job.title } }],
      },
      Company: {
        rich_text: [{ text: { content: job.company } }],
      },
      Status: {
        select: { name: "Researching" },
      },
      "Fit Score": {
        select: { name: fitScoreLabel(evaluation.fitScore) },
      },
      Location: {
        rich_text: [{ text: { content: job.location } }],
      },
      "Salary Range": {
        rich_text: [
          { text: { content: formatSalary(job.salaryMin, job.salaryMax) } },
        ],
      },
      "Job Posting URL": {
        url: job.url,
      },
      Notes: {
        rich_text: [{ text: { content: notes.slice(0, 2000) } }],
      },
    },
  });
}

export async function logAllToNotion(
  notion: Client,
  databaseId: string,
  scoredJobs: ScoredJob[]
): Promise<number> {
  let logged = 0;

  for (const scoredJob of scoredJobs) {
    if (
      scoredJob.evaluation.recommendation !== "apply" &&
      scoredJob.evaluation.recommendation !== "research"
    ) {
      continue;
    }

    try {
      if (logged > 0) {
        await sleep(NOTION_RATE_DELAY_MS);
      }
      await logToNotion(notion, databaseId, scoredJob);
      console.log(
        `[LOG] Logged: "${scoredJob.job.title}" at ${scoredJob.job.company} (score: ${scoredJob.evaluation.fitScore})`
      );
      logged++;
    } catch (err) {
      console.error(
        `[LOG] Failed to log "${scoredJob.job.title}" at ${scoredJob.job.company}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return logged;
}
