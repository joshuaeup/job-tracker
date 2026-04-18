import { faker } from '@faker-js/faker';

import type { NormalizedJob } from '../../types/index.js';

/**
 * Builds a realistic NormalizedJob with randomised field values.
 * Pin individual fields via `overrides` when a test depends on a specific value.
 *
 * @example
 * const job = fakeNormalizedJob({ title: 'Software Engineer', remote: true });
 */
export function fakeNormalizedJob(
  overrides: Partial<NormalizedJob> = {},
): NormalizedJob {
  const id = faker.string.uuid();
  const company = faker.company.name();
  const companySlug = company.toLowerCase().replace(/\s+/g, '-');

  return {
    id: `greenhouse:${companySlug}:${id}`,
    title: 'Software Engineer',
    company,
    location: 'Remote',
    remote: true,
    url: faker.internet.url(),
    department: faker.commerce.department(),
    ats: 'greenhouse',
    postedAt: faker.date.recent().toISOString(),
    salaryMin: null,
    salaryMax: null,
    descriptionText: faker.lorem.paragraph(),
    ...overrides,
  };
}
