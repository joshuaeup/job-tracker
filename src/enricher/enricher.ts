import { createLogger } from '../lib/logger.js';
import type { NormalizedJob } from '../types/index.js';
import { parseSalaryFromText } from './salary-parser.js';

const WORKDAY_RATE_DELAY_MS = 150;

type WorkdayDetailResponse = {
  jobPostingInfo?: {
    jobDescription?: string;
  };
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

// Transforms the stored en-US job URL to the internal CXS API detail endpoint.
// e.g. https://vanguard.wd5.myworkdayjobs.com/en-US/vanguard_external/job/...
//   -> https://vanguard.wd5.myworkdayjobs.com/wday/cxs/vanguard/vanguard_external/job/...
const toWorkdayCxsUrl = (jobUrl: string): string => {
  const parsed = new URL(jobUrl);
  const company = parsed.hostname.split('.')[0] ?? '';
  const cxsPath = parsed.pathname.replace('/en-US/', `/wday/cxs/${company}/`);
  return `${parsed.origin}${cxsPath}`;
};

const fetchWorkdayDescription = async (jobUrl: string): Promise<string> => {
  const cxsUrl = toWorkdayCxsUrl(jobUrl);
  const response = await fetch(cxsUrl);
  if (!response.ok) return '';
  const data = (await response.json()) as WorkdayDetailResponse;
  const html = data.jobPostingInfo?.jobDescription ?? '';
  return html ? stripHtml(html) : '';
};

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
export const enrich = async (jobs: NormalizedJob[]): Promise<NormalizedJob[]> => {
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
        log.warn(`Failed to fetch description for "${job.title}" at ${job.company}`);
      }
      workdayFetched++;
    }

    const alreadyHasSalary = job.salaryMin !== null || job.salaryMax !== null;
    const { min, max } = alreadyHasSalary
      ? { min: job.salaryMin, max: job.salaryMax }
      : parseSalaryFromText(description);

    if (!alreadyHasSalary && min !== null) salaryFound++;

    results.push({ ...job, descriptionText: description, salaryMin: min, salaryMax: max });
  }

  log.info(`Enriched ${results.length} jobs — salary found for ${salaryFound}`);
  return results;
};
