import { createLogger } from '../lib/logger.js';
import type { NormalizedJob, RawJob } from '../types/index.js';

/** Returns true if `value` is a non-null, non-array plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Safely converts an unknown value to a string, returning "" for objects/null/undefined. */
function toStr(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-');
}

function isRemote(location: string): boolean {
  return /remote/i.test(location);
}

function parseLocation(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (isRecord(raw) && typeof raw['name'] === 'string') return raw['name'];
  return '';
}

function parseSalary(compensation: unknown): {
  min: number | null;
  max: number | null;
} {
  if (!isRecord(compensation)) return { min: null, max: null };

  const rawMin = compensation['min_value'] ?? compensation['minValue'];
  const rawMax = compensation['max_value'] ?? compensation['maxValue'];

  return {
    min: typeof rawMin === 'number' ? rawMin : null,
    max: typeof rawMax === 'number' ? rawMax : null,
  };
}

function parseGreenhouseSalary(metadata: unknown): {
  min: number | null;
  max: number | null;
} {
  if (!Array.isArray(metadata)) return { min: null, max: null };

  const entry = metadata.find(
    (m): m is Record<string, unknown> =>
      isRecord(m) &&
      m['value_type'] === 'currency_range' &&
      isRecord(m['value']),
  );

  if (!entry) return { min: null, max: null };

  const value = entry['value'] as Record<string, unknown>;
  const rawMin = value['min_value'];
  const rawMax = value['max_value'];

  const min = typeof rawMin === 'string' ? parseFloat(rawMin) : null;
  const max = typeof rawMax === 'string' ? parseFloat(rawMax) : null;

  return {
    min: min !== null && !isNaN(min) ? min : null,
    max: max !== null && !isNaN(max) ? max : null,
  };
}

function normalizeGreenhouse(job: RawJob): NormalizedJob {
  const r = job.raw;

  const idRaw = toStr(r['id']);
  const title = toStr(r['title']);
  const location = parseLocation(r['location']);
  const url = toStr(r['absolute_url']);

  const departments = r['departments'];
  const firstDept = Array.isArray(departments) ? departments[0] : undefined;
  const department =
    isRecord(firstDept) && typeof firstDept['name'] === 'string'
      ? firstDept['name']
      : '';

  const postedAt =
    typeof r['updated_at'] === 'string'
      ? r['updated_at']
      : typeof r['first_published'] === 'string'
        ? r['first_published']
        : null;

  const content = r['content'];
  const descriptionHtml =
    typeof r['description'] === 'string'
      ? r['description']
      : isRecord(content) && typeof content['description'] === 'string'
        ? content['description']
        : '';

  const { min, max } = parseGreenhouseSalary(r['metadata']);

  return {
    id: `greenhouse:${slugify(job.company)}:${idRaw}`,
    title,
    company: job.company,
    location,
    remote: isRemote(location),
    url,
    department,
    ats: 'greenhouse',
    postedAt,
    salaryMin: min,
    salaryMax: max,
    descriptionText: stripHtml(descriptionHtml),
  };
}

function normalizeLever(job: RawJob): NormalizedJob {
  const r = job.raw;

  const idRaw = toStr(r['id']);
  const title = toStr(r['text']);

  const categories = isRecord(r['categories']) ? r['categories'] : null;
  const location = toStr(
    categories?.['location'] ?? categories?.['allLocations'],
  );
  const url = toStr(r['hostedUrl']);
  const department = toStr(categories?.['team'] ?? categories?.['department']);

  const createdAt = r['createdAt'];
  const postedAt =
    typeof createdAt === 'number' ? new Date(createdAt).toISOString() : null;

  const descriptionText = toStr(r['descriptionPlain']);
  const { min, max } = parseSalary(r['salaryRange'] ?? r['compensation']);

  return {
    id: `lever:${slugify(job.company)}:${idRaw}`,
    title,
    company: job.company,
    location,
    remote: isRemote(location),
    url,
    department,
    ats: 'lever',
    postedAt,
    salaryMin: min,
    salaryMax: max,
    descriptionText,
  };
}

function normalizeAshby(job: RawJob): NormalizedJob {
  const r = job.raw;

  const idRaw = toStr(r['id']);
  const title = toStr(r['title']);
  const location = parseLocation(r['location'] ?? r['locationName']);
  const url = toStr(r['jobUrl'] ?? r['applyUrl']);
  const department = toStr(r['departmentName'] ?? r['department']);

  const postedAt =
    typeof r['publishedAt'] === 'string'
      ? r['publishedAt']
      : typeof r['createdAt'] === 'string'
        ? r['createdAt']
        : null;

  const descriptionHtml = toStr(r['descriptionHtml'] ?? r['description']);
  const { min, max } = parseSalary(r['compensation'] ?? r['salaryRange']);

  return {
    id: `ashby:${slugify(job.company)}:${idRaw}`,
    title,
    company: job.company,
    location,
    remote: isRemote(location) || r['workplaceType'] === 'Remote',
    url,
    department,
    ats: 'ashby',
    postedAt,
    salaryMin: min,
    salaryMax: max,
    descriptionText: stripHtml(descriptionHtml),
  };
}

function normalizeWorkday(job: RawJob): NormalizedJob {
  const r = job.raw;

  const baseUrl = typeof r['__baseUrl'] === 'string' ? r['__baseUrl'] : '';
  const externalPath = toStr(r['externalPath']);
  const url = externalPath ? `${baseUrl}${externalPath}` : '';

  // jobReqId is the stable identifier; fall back to extracting from externalPath
  const idRaw =
    toStr(r['jobReqId'] ?? r['bulletFields[0]']) ||
    externalPath.split('_').pop() ||
    externalPath;

  const title = toStr(r['title']);
  const location = toStr(r['locationsText']);

  return {
    id: `workday:${slugify(job.company)}:${idRaw}`,
    title,
    company: job.company,
    location,
    remote: isRemote(location),
    url,
    department: '',
    ats: 'workday',
    postedAt: null,
    salaryMin: null,
    salaryMax: null,
    descriptionText: '',
  };
}

const NORMALIZERS = {
  greenhouse: normalizeGreenhouse,
  lever: normalizeLever,
  ashby: normalizeAshby,
  workday: normalizeWorkday,
} as const;

/**
 * Maps an array of raw ATS job responses to a common `NormalizedJob` schema.
 * Jobs with no URL are dropped. Normalization errors for individual jobs are
 * logged and skipped without aborting the batch.
 */
export function normalize(rawJobs: RawJob[]): NormalizedJob[] {
  const log = createLogger('NORMALIZE');
  const results: NormalizedJob[] = [];

  for (const job of rawJobs) {
    try {
      const normalized = NORMALIZERS[job.source](job);

      if (normalized.url) {
        results.push(normalized);
      }
    } catch (err: unknown) {
      log.error(
        `Failed to normalize job from ${job.company} (${job.source})`,
        err,
      );
    }
  }

  return results;
}
