import { fetchWorkdayDescription } from '../fetchers/workday/workday.js';
import { createLogger } from '../lib/logger.js';
import type { NormalizedJob } from '../types/index.js';
import { parseSalaryFromText } from './salary-parser.js';

const WORKDAY_RATE_DELAY_MS = 150;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Enriches a filtered job list with descriptions and parsed salary ranges.
 *
 * Workday list responses omit descriptions, so each Workday job receives a
 * separate detail fetch. All other ATS types already include the description.
 * Salary is parsed from the description text for any job where it is not
 * already set by the ATS.
 *
 * @returns A copy of each job with descriptionText and salary fields updated.
 */
export const enrich = async (
  jobs: NormalizedJob[],
): Promise<NormalizedJob[]> => {
  const log = createLogger('ENRICH');
  const results: NormalizedJob[] = [];
  let workdayFetched = 0;
  let salaryFound = 0;

  for (const job of jobs) {
    let description = job.descriptionText;

    if (job.ats === 'workday') {
      if (workdayFetched > 0) await sleep(WORKDAY_RATE_DELAY_MS);
      try {
        description = await fetchWorkdayDescription(job.url);
      } catch {
        log.warn(
          `Failed to fetch description for "${job.title}" at ${job.company}`,
        );
      }
      workdayFetched++;
    }

    const alreadyHasSalary = job.salaryMin !== null || job.salaryMax !== null;
    const { min, max } = alreadyHasSalary
      ? { min: job.salaryMin, max: job.salaryMax }
      : parseSalaryFromText(description);

    if (!alreadyHasSalary && min !== null) salaryFound++;

    results.push({
      ...job,
      descriptionText: description,
      salaryMin: min,
      salaryMax: max,
    });
  }

  log.info(`Enriched ${results.length} jobs — salary found for ${salaryFound}`);
  return results;
};
