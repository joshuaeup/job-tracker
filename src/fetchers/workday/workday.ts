import type { CompanyConfig, RawJob } from '../../types/index.js';
import type { WorkdayJob, WorkdayResponse } from './types.js';

const PAGE_SIZE = 20;

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
  const baseUrl = `https://${hostPrefix}.myworkdayjobs.com`;
  const apiUrl = `${baseUrl}/wday/cxs/${cxsPath}/jobs`;

  const allPostings: WorkdayJob[] = [];
  let offset = 0;

  while (true) {
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

    allPostings.push(...page);

    if (allPostings.length >= data.total || page.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return allPostings.map((item) => ({
    source: 'workday' as const,
    company: config.name,
    raw: {
      ...(item as unknown as Record<string, unknown>),
      __baseUrl: baseUrl,
    },
  }));
};

export default fetchWorkday;
