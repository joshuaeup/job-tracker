/** The ATS platforms supported by the pipeline. */
export type AtsSource = 'ashby' | 'greenhouse' | 'lever' | 'workday';

/** Configuration entry for a single target company. */
export type CompanyConfig = {
  /** Display name shown in logs and Notion rows. */
  name: string;
  /** ATS platform this company uses. */
  ats: AtsSource;
  /** ATS board slug used to construct the API URL. */
  slug: string;
  /** Set to false to pause fetching without removing the entry. */
  enabled: boolean;
};

/** Raw job posting as returned by an ATS fetcher, before normalization. */
export type RawJob = {
  /** Which ATS platform produced this record. */
  source: AtsSource;
  /** Display name of the company this job belongs to. */
  company: string;
  /** Untouched response object from the ATS API. */
  raw: Record<string, unknown>;
};

/** Job posting normalized to a common schema, ready for filtering and evaluation. */
export type NormalizedJob = {
  /** Stable unique ID in the format `{ats}:{company-slug}:{ats-job-id}`. */
  id: string;
  title: string;
  company: string;
  /** Raw location string from the ATS posting. */
  location: string;
  /** True if the location string contains "remote" (case-insensitive). */
  remote: boolean;
  /** Direct link to the job posting. */
  url: string;
  department: string;
  ats: AtsSource;
  /** ISO 8601 date string if available, otherwise null. */
  postedAt: string | null;
  /** Minimum salary in USD if listed, otherwise null. */
  salaryMin: number | null;
  /** Maximum salary in USD if listed, otherwise null. */
  salaryMax: number | null;
  /** Plain text job description, stripped of HTML. */
  descriptionText: string;
};

/** Counts logged at the end of each pipeline run. */
export type RunSummary = {
  fetched: number;
  filtered: number;
  deduplicated: number;
};
