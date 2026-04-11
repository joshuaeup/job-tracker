import { Client } from "@notionhq/client";
import type { ScoredJob } from "../types/index.js";
import { createLogger } from "../lib/logger.js";

const NOTION_RATE_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fitScoreLabel(score: number): string {
  if (score >= 85) return "Strong Fit";
  if (score >= 70) return "Good Fit";
  if (score >= 50) return "Reach";
  return "Poor Fit";
}

function formatSalary(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  }
  if (min !== null) return `$${min.toLocaleString()}+`;
  return "Not listed";
}

/**
 * Creates a single Notion page in the Job Tracker database for a qualifying
 * scored job. All standard fields are pre-populated from the job and
 * evaluation data.
 *
 * @throws {Error} If the Notion API call fails.
 */
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
      // "Company" is the Title property (Aa column) in this database
      Company: {
        title: [{ text: { content: job.company } }],
      },
      // "Role Title" is a Text property
      "Role Title": {
        rich_text: [{ text: { content: job.title } }],
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
      // "Notes" is a Text property — add this column to your database if not present
      Notes: {
        rich_text: [{ text: { content: notes.slice(0, 2000) } }],
      },
    },
  });
}

/**
 * Logs all qualifying scored jobs (recommendation `apply` or `research`) to
 * Notion, enforcing a 400ms delay between writes to respect the API rate limit.
 *
 * @returns The number of rows successfully written to Notion.
 */
export async function logAllToNotion(
  notion: Client,
  databaseId: string,
  scoredJobs: ScoredJob[]
): Promise<number> {
  const log = createLogger("LOG");
  let logged = 0;

  for (const scoredJob of scoredJobs) {
    const { recommendation } = scoredJob.evaluation;

    if (recommendation !== "apply" && recommendation !== "research") {
      continue;
    }

    try {
      if (logged > 0) {
        await sleep(NOTION_RATE_DELAY_MS);
      }

      await logToNotion(notion, databaseId, scoredJob);

      log.info(
        `Logged "${scoredJob.job.title}" at ${scoredJob.job.company} — score: ${scoredJob.evaluation.fitScore}`
      );
      logged++;
    } catch (err: unknown) {
      log.error(
        `Failed to log "${scoredJob.job.title}" at ${scoredJob.job.company}`,
        err
      );
    }
  }

  return logged;
}
