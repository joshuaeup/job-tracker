import { faker } from '@faker-js/faker';

import type { LeverJob, LeverResponse } from '../types.js';

/**
 * Builds a realistic LeverJob with randomised field values.
 * Pin individual fields via `overrides` when a test depends on a specific value.
 */
export const fakeLeverJob = (overrides: Partial<LeverJob> = {}): LeverJob => ({
  id: faker.string.uuid(),
  text: 'Software Engineer',
  hostedUrl: faker.internet.url(),
  categories: {
    location: faker.location.city(),
    team: faker.commerce.department(),
  },
  createdAt: faker.date.recent().getTime(),
  ...overrides,
});

/**
 * Builds a realistic LeverResponse containing the given jobs.
 * Defaults to a single randomised job if none are provided.
 */
export const fakeLeverResponse = (jobs?: LeverJob[]): LeverResponse =>
  jobs ?? [fakeLeverJob()];
