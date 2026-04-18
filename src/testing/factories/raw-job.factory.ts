import { faker } from '@faker-js/faker';

import type { RawJob } from '../../types/index.js';

/**
 * Builds a RawJob as it arrives from a given ATS source.
 * The `raw` field is typed loosely to mirror real ATS API responses.
 * Pin individual fields via `overrides` when a test depends on a specific value.
 *
 * @example
 * const job = fakeRawJob('greenhouse', { title: 'Backend Engineer' });
 */
export function fakeRawJob(
  source: RawJob['source'],
  raw: Record<string, unknown> = {},
): RawJob {
  return {
    source,
    company: faker.company.name(),
    raw,
  };
}

/**
 * Builds a valid raw Greenhouse job payload with randomised field values.
 *
 * @example
 * const job = fakeGreenhouseRaw({ title: 'Backend Engineer' });
 */
export function fakeGreenhouseRaw(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: faker.number.int({ min: 1000, max: 999999 }),
    title: 'Software Engineer',
    location: { name: faker.location.city() },
    absolute_url: faker.internet.url(),
    departments: [{ name: faker.commerce.department() }],
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  };
}

/**
 * Builds a valid raw Lever job payload with randomised field values.
 *
 * @example
 * const job = fakeLeverRaw({ text: 'Senior Engineer' });
 */
export function fakeLeverRaw(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: faker.string.uuid(),
    text: 'Software Engineer',
    hostedUrl: faker.internet.url(),
    categories: {
      location: faker.location.city(),
      team: faker.commerce.department(),
    },
    createdAt: faker.date.recent().getTime(),
    ...overrides,
  };
}

/**
 * Builds a valid raw Ashby job payload with randomised field values.
 *
 * @example
 * const job = fakeAshbyRaw({ title: 'Platform Engineer' });
 */
export function fakeAshbyRaw(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: faker.string.uuid(),
    title: 'Software Engineer',
    locationName: faker.location.city(),
    jobUrl: faker.internet.url(),
    workplaceType: 'OnSite',
    ...overrides,
  };
}
