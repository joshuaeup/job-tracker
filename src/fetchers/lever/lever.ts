import type { CompanyConfig, RawJob } from '../../types/index.js';
import type { LeverJob, LeverResponse } from './types.js';

/**
 * Fetches all job postings for a company from the Lever ATS public API.
 *
 * @throws {Error} If the HTTP response is not OK.
 */
export const fetchLever = async (config: CompanyConfig): Promise<RawJob[]> => {
  const url = `https://api.lever.co/v0/postings/${config.slug}?mode=json`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Lever fetch failed for ${config.name}: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as LeverResponse;

  return data.map((item: LeverJob) => ({
    source: 'lever' as const,
    company: config.name,
    raw: item as unknown as Record<string, unknown>,
  }));
};

export default fetchLever;
