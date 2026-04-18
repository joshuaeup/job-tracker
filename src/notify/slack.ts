import type { NormalizedJob } from '../types/index.js';

const formatSalary = (min: number | null, max: number | null): string => {
  if (min !== null && max !== null) {
    return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  }
  if (min !== null) return `$${min.toLocaleString()}+`;
  return 'Not listed';
};

const buildReviewDigest = (date: string, jobs: NormalizedJob[]): string => {
  if (jobs.length === 0) {
    return `*Job Search Run — ${date}*\nNo new roles found after filtering and deduplication.`;
  }

  const lines = [
    `*🔍 Job Search Run — ${date}*`,
    `*${jobs.length} new role(s) passed filters — manual review needed*`,
    '',
  ];

  for (const job of jobs) {
    const salary = formatSalary(job.salaryMin, job.salaryMax);
    const remote = job.remote ? 'Remote' : job.location;

    lines.push(`*${job.company}*`);
    lines.push(`>${job.title}`);
    lines.push(`>📍 ${remote}   💰 ${salary}`);
    lines.push(`><${job.url}|View posting>`);
    lines.push('');
  }

  return lines.join('\n').trim();
};

/**
 * Posts a digest of all new filtered and deduped roles to Slack for manual review.
 *
 * @throws {Error} If the webhook POST returns a non-OK status.
 */
export const sendReviewDigest = async (
  webhookUrl: string,
  date: string,
  jobs: NormalizedJob[],
): Promise<void> => {
  const text = buildReviewDigest(date, jobs);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(
      `Slack webhook failed: ${response.status} ${response.statusText}`,
    );
  }
};
