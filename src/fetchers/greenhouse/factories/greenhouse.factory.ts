import { faker } from '@faker-js/faker';

import type { GreenhouseJob, GreenhouseResponse } from '../types.js';

/**
 * Builds a realistic GreenhouseJob with randomised field values.
 * Pin individual fields via `overrides` when a test depends on a specific value.
 */
export const fakeGreenhouseJob = (
  overrides: Partial<GreenhouseJob> = {},
): GreenhouseJob => ({
  id: faker.number.int({ min: 1000, max: 999999 }),
  title: 'Software Engineer',
  location: { name: faker.location.city() },
  absolute_url: faker.internet.url(),
  departments: [{ name: faker.commerce.department() }],
  updated_at: faker.date.recent().toISOString(),
  ...overrides,
});

/**
 * Builds a realistic GreenhouseResponse containing the given jobs.
 * Defaults to a single randomised job if none are provided.
 */
export const fakeGreenhouseResponse = (
  jobs?: GreenhouseJob[],
): GreenhouseResponse => ({
  jobs: jobs ?? [fakeGreenhouseJob()],
});
