import { faker } from '@faker-js/faker';

import type { WorkdayJob, WorkdayResponse } from '../types.js';

/**
 * Builds a realistic WorkdayJob with randomised field values.
 * Pin individual fields via `overrides` when a test depends on a specific value.
 */
export const fakeWorkdayJob = (
  overrides: Partial<WorkdayJob> = {},
): WorkdayJob => ({
  title: 'Software Engineer',
  externalPath: `/en-US/jobs/${faker.string.alphanumeric(8)}_${faker.string.uuid()}`,
  locationsText: faker.location.city(),
  jobReqId: faker.string.alphanumeric(8),
  ...overrides,
});

/**
 * Builds a realistic WorkdayResponse containing the given jobs.
 * Defaults to a single randomised job if none are provided.
 */
export const fakeWorkdayResponse = (jobs?: WorkdayJob[]): WorkdayResponse => {
  const jobPostings = jobs ?? [fakeWorkdayJob()];
  return {
    jobPostings,
    total: jobPostings.length,
  };
};
