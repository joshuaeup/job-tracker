import type { Client } from '@notionhq/client';

import { createLogger } from '../lib/logger.js';
import type { NormalizedJob } from '../types/index.js';

const NOTION_RATE_DELAY_MS = 400;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Maps a raw ATS location string to the closest canonical Notion select option.
 * Falls back to the raw string so Notion creates a new option rather than
 * losing the data entirely.
 */
const normalizeLocationLabel = (location: string, remote: boolean): string => {
  if (remote) return 'Remote';

  const lower = location.toLowerCase();

  if (lower.includes('remote')) return 'Remote';
  if (lower.includes('charlotte')) return 'Charlotte NC';
  if (
    lower.includes('new york') ||
    lower.includes(', ny') ||
    lower.includes('nyc')
  )
    return 'New York';
  if (lower.includes('london')) return 'London';
  if (lower.includes('fort mill')) return 'Fort Mill SC';

  // Notion select options don't allow commas — use only the first segment
  // (e.g. "San Francisco, California" → "San Francisco")
  return location.split(',')[0]?.trim() ?? location;
};

const formatSalary = (min: number | null, max: number | null): string => {
  if (min !== null && max !== null) {
    return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  }
  if (min !== null) return `$${min.toLocaleString()}+`;
  return 'Not listed';
};

/**
 * Writes a batch of new jobs to Notion with status set to "Researching".
 * A 400ms delay between writes keeps requests within Notion's rate limit.
 *
 * @returns The number of rows successfully written.
 */
export const logJobsToNotion = async (
  notion: Client,
  databaseId: string,
  jobs: NormalizedJob[],
): Promise<number> => {
  const log = createLogger('LOG');
  let logged = 0;

  for (const job of jobs) {
    try {
      if (logged > 0) {
        await sleep(NOTION_RATE_DELAY_MS);
      }

      await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          Company: {
            title: [{ text: { content: job.company } }],
          },
          'Role Title': {
            rich_text: [{ text: { content: job.title } }],
          },
          Status: {
            select: { name: 'Researching' },
          },
          Location: {
            select: { name: normalizeLocationLabel(job.location, job.remote) },
          },
          'Salary Range': {
            rich_text: [
              { text: { content: formatSalary(job.salaryMin, job.salaryMax) } },
            ],
          },
          'Job Posting URL': {
            url: job.url,
          },
        },
      });

      log.info(`Logged "${job.title}" at ${job.company}`);
      logged++;
    } catch (err: unknown) {
      log.error(`Failed to log "${job.title}" at ${job.company}`, err);
    }
  }

  return logged;
};
