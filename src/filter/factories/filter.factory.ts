import { fakeNormalizedJob } from '../../testing/factories/normalized-job.factory.js';
import type { NormalizedJob } from '../../types/index.js';

/**
 * Builds a job that passes all active filters — title allowlisted, remote,
 * no blocked seniority term. Use this as the baseline in filter tests.
 */
export const makePassingJob = (
  overrides: Partial<NormalizedJob> = {},
): NormalizedJob =>
  fakeNormalizedJob({
    title: 'Software Engineer',
    location: 'Remote',
    remote: true,
    ...overrides,
  });

/**
 * Builds a job whose title does not appear in the allowlist and will therefore
 * be filtered out by the title check.
 */
export const makeJobFailingTitle = (
  overrides: Partial<NormalizedJob> = {},
): NormalizedJob =>
  fakeNormalizedJob({
    title: 'Product Designer',
    location: 'Remote',
    remote: true,
    ...overrides,
  });

/**
 * Builds a job whose title contains a blocked seniority term ("Junior") and
 * will therefore be filtered out by the seniority check.
 */
export const makeJobFailingSeniority = (
  overrides: Partial<NormalizedJob> = {},
): NormalizedJob =>
  fakeNormalizedJob({
    title: 'Junior Software Engineer',
    location: 'Remote',
    remote: true,
    ...overrides,
  });

/**
 * Builds a job whose location is a non-US country that appears on the blocklist
 * and will therefore be filtered out by the location check.
 */
export const makeJobFailingLocation = (
  overrides: Partial<NormalizedJob> = {},
): NormalizedJob =>
  fakeNormalizedJob({
    title: 'Software Engineer',
    location: 'London, UK',
    remote: false,
    ...overrides,
  });
