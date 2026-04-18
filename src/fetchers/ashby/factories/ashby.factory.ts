import { faker } from '@faker-js/faker';

import type { AshbyJob, AshbyResponse } from '../types.js';

/**
 * Builds a realistic AshbyJob with randomised field values.
 * Pin individual fields via `overrides` when a test depends on a specific value.
 */
export const fakeAshbyJob = (overrides: Partial<AshbyJob> = {}): AshbyJob => ({
  id: faker.string.uuid(),
  title: 'Software Engineer',
  locationName: faker.location.city(),
  jobUrl: faker.internet.url(),
  workplaceType: 'OnSite',
  departmentName: faker.commerce.department(),
  publishedAt: faker.date.recent().toISOString(),
  ...overrides,
});

/**
 * Builds a realistic AshbyResponse containing the given jobs.
 * Defaults to a single randomised job if none are provided.
 */
export const fakeAshbyResponse = (jobs?: AshbyJob[]): AshbyResponse => ({
  jobs: jobs ?? [fakeAshbyJob()],
});
