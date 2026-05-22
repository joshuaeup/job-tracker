import type { CompanyConfig, RawJob } from '../../types/index.js';
import type { WorkdayJob, WorkdayResponse } from './types.js';

const PAGE_SIZE = 20;

type WorkdayDetailResponse = {
  jobPostingInfo?: {
    jobDescription?: string;
  };
};

const stripHtml = (html: string): string =>
  html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

// Transforms the stored en-US job URL to the internal CXS API detail endpoint.
// e.g. https://vanguard.wd5.myworkdayjobs.com/en-US/vanguard_external/job/...
//   -> https://vanguard.wd5.myworkdayjobs.com/wday/cxs/vanguard/vanguard_external/job/...
const toWorkdayCxsUrl = (jobUrl: string): string => {
  const parsed = new URL(jobUrl);
  // istanbul ignore next — split always produces at least one element; '' is unreachable
  const company = parsed.hostname.split('.')[0] ?? '';
  const cxsPath = parsed.pathname.replace('/en-US/', `/wday/cxs/${company}/`);
  return `${parsed.origin}${cxsPath}`;
};

/**
 * Fetches the full job description for a single Workday posting.
 * Returns an empty string if the fetch fails or the description is absent.
 */
export const fetchWorkdayDescription = async (
  jobUrl: string,
): Promise<string> => {
  const cxsUrl = toWorkdayCxsUrl(jobUrl);
  const response = await fetch(cxsUrl);
  if (!response.ok) return '';
  const data = (await response.json()) as WorkdayDetailResponse;
  const html = data.jobPostingInfo?.jobDescription ?? '';
  return html ? stripHtml(html) : '';
};

/**
 * Fetches all job postings for a company from the Workday ATS public API.
 *
 * The `slug` field must be formatted as `<subdomain>.<pod>/<cxs-company>/<cxs-site>`,
 * e.g. `acme.wd5/acme/search`. This maps to:
 *   https://<subdomain>.<pod>.myworkdayjobs.com/wday/cxs/<cxs-company>/<cxs-site>/jobs
 *
 * @throws {Error} If the slug is malformed or the HTTP response is not OK.
 */
export const fetchWorkday = async (
  config: CompanyConfig,
): Promise<RawJob[]> => {
  const slashIndex = config.slug.indexOf('/');
  if (slashIndex === -1) {
    throw new Error(
      `Workday slug for ${config.name} must be formatted as "<subdomain>.<pod>/<cxs-path>", got: "${config.slug}"`,
    );
  }

  const hostPrefix = config.slug.slice(0, slashIndex);
  const cxsPath = config.slug.slice(slashIndex + 1);
  // istanbul ignore next — pop() is undefined only on empty arrays; split never returns []
  const siteName = cxsPath.split('/').pop() ?? cxsPath;
  const baseUrl = `https://${hostPrefix}.myworkdayjobs.com`;
  const jobUrlBase = `${baseUrl}/en-US/${siteName}`;
  const apiUrl = `${baseUrl}/wday/cxs/${cxsPath}/jobs`;

  const allPostings: WorkdayJob[] = [];
  let offset = 0;
  let total = Infinity;

  while (allPostings.length < total) {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: PAGE_SIZE,
        offset,
        searchText: '',
        appliedFacets: {},
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Workday fetch failed for ${config.name}: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as WorkdayResponse;
    const page: WorkdayJob[] = data.jobPostings ?? [];

    // Workday only returns the correct total on the first page; capture it once.
    if (offset === 0 && data.total > 0) total = data.total;

    allPostings.push(...page);

    if (page.length < PAGE_SIZE) break;

    offset += PAGE_SIZE;
  }

  return allPostings.map((item) => ({
    source: 'workday' as const,
    company: config.name,
    raw: {
      ...(item as unknown as Record<string, unknown>),
      __baseUrl: jobUrlBase,
    },
  }));
};

export default fetchWorkday;
