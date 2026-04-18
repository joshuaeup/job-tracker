import { createLogger } from '../lib/logger.js';
import type { CompanyConfig, RawJob } from '../types/index.js';
import fetchAshby from './ashby/ashby.js';
import fetchGreenhouse from './greenhouse/greenhouse.js';
import fetchLever from './lever/lever.js';
import fetchWorkday from './workday/workday.js';

const FETCHERS = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
  workday: fetchWorkday,
} as const;

/**
 * Runs all enabled company fetchers sequentially and aggregates results.
 * A failure for any single company is logged and skipped — it never aborts
 * the full run.
 */
export const fetchAll = async (
  companies: CompanyConfig[],
): Promise<RawJob[]> => {
  const log = createLogger('FETCH');
  const enabled = companies.filter((c) => c.enabled);
  const allJobs: RawJob[] = [];

  for (const company of enabled) {
    try {
      log.info(`Fetching ${company.name} (${company.ats})`);

      const fetcher = FETCHERS[company.ats];
      const jobs = await fetcher(company);

      log.info(`${company.name}: ${jobs.length} jobs found`);
      allJobs.push(...jobs);
    } catch (err: unknown) {
      log.error(`Failed to fetch ${company.name}`, err);
    }
  }

  return allJobs;
};
