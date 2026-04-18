import 'dotenv/config';

import { Client } from '@notionhq/client';

import { companies } from './config/companies/index.js';
import { deduplicate } from './dedup/notion.js';
import { fetchAll } from './fetchers/index.js';
import { filter } from './filter/index.js';
import { createLogger } from './lib/logger.js';
import { logJobsToNotion } from './logger/notion.js';
import { normalize } from './normalizer/index.js';
import { sendReviewDigest } from './notify/slack.js';
import type { RunSummary } from './types/index.js';
import { today } from './utils/date.js';
import { requireEnv } from './utils/env.js';
import { printSummary } from './utils/summary.js';

/**
 * Orchestrates the full job search pipeline.
 *
 * Exits the process on any unrecoverable error.
 */
const run = async (): Promise<void> => {
  const log = createLogger('PIPELINE');

  try {
    log.info(`Starting job search pipeline — ${today()}`);

    const notionToken = requireEnv('NOTION_TOKEN');
    const notionDatabaseId = requireEnv('NOTION_DATABASE_ID');
    const slackWebhook = requireEnv('SLACK_WEBHOOK_URL');

    const notion = new Client({ auth: notionToken });
    const summary: RunSummary = {
      fetched: 0,
      filtered: 0,
      deduplicated: 0,
    };

    const allJobs = await fetchAll(companies);

    const normalized = normalize(allJobs);
    summary.fetched = normalized.length;

    const filtered = filter(normalized);
    summary.filtered = filtered.length;

    const newJobs = await deduplicate(notion, notionDatabaseId, filtered);
    summary.deduplicated = newJobs.length;

    if (newJobs.length === 0) {
      log.info('No new roles found. Exiting.');
      await sendReviewDigest(slackWebhook, today(), newJobs);

      printSummary(summary);
      return;
    }

    await logJobsToNotion(notion, notionDatabaseId, newJobs);
    await sendReviewDigest(slackWebhook, today(), newJobs);

    printSummary(summary);
  } catch (err: unknown) {
    log.error('Fatal error', err);
    return;
  }
};

await run();
