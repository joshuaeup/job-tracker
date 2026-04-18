import type { Client } from '@notionhq/client';

import { createLogger } from '../lib/logger.js';
import type { NormalizedJob } from '../types/index.js';

const NOTION_RATE_DELAY_MS = 400;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const fetchSeenUrls = async (
  notion: Client,
  databaseId: string,
): Promise<Set<string>> => {
  const seen = new Set<string>();
  let cursor: string | undefined = undefined;

  do {
    const response = await notion.databases.query(
      cursor
        ? { database_id: databaseId, start_cursor: cursor, page_size: 100 }
        : { database_id: databaseId, page_size: 100 },
    );

    for (const page of response.results) {
      if (!('properties' in page)) continue;
      const props = page.properties;

      const urlProp = props['Job Posting URL'];
      if (
        urlProp?.type === 'url' &&
        typeof urlProp.url === 'string' &&
        urlProp.url
      ) {
        seen.add(urlProp.url);
      }
    }

    const next = response.has_more ? response.next_cursor : null;
    cursor = typeof next === 'string' ? next : undefined;

    if (cursor) {
      await sleep(NOTION_RATE_DELAY_MS);
    }
  } while (cursor);

  return seen;
};

/**
 * Fetches all known job URLs from the Notion tracker, then returns only the
 * jobs whose URL has not been seen before. Uses paginated queries with a 400ms
 * delay between pages to stay within Notion's rate limit.
 *
 * @returns Jobs not yet present in the tracker.
 */
export const deduplicate = async (
  notion: Client,
  databaseId: string,
  jobs: NormalizedJob[],
): Promise<NormalizedJob[]> => {
  const log = createLogger('DEDUP');
  log.info('Fetching seen URLs from Notion...');

  const seenUrls = await fetchSeenUrls(notion, databaseId);
  log.info(`Known URLs in Notion: ${seenUrls.size}`);

  const newJobs = jobs.filter((job) => !seenUrls.has(job.url));
  log.info(`New jobs after deduplication: ${newJobs.length}`);

  return newJobs;
};
