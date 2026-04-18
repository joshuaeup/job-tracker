import { faker } from '@faker-js/faker';

import type { RawJob } from '../../types/index.js';

/**
 * Builds a complete Greenhouse `RawJob` ready to be passed to `normalize`.
 * All fields default to realistic randomised values; override only what the
 * test depends on.
 */
export const fakeGreenhouseRawJob = (
  rawOverrides: Record<string, unknown> = {},
  company = faker.company.name(),
): RawJob => ({
  source: 'greenhouse',
  company,
  raw: {
    id: faker.number.int({ min: 1000, max: 999999 }),
    title: 'Software Engineer',
    location: { name: faker.location.city() },
    absolute_url: faker.internet.url(),
    departments: [{ name: faker.commerce.department() }],
    updated_at: faker.date.recent().toISOString(),
    ...rawOverrides,
  },
});

/**
 * Builds a complete Lever `RawJob` ready to be passed to `normalize`.
 */
export const fakeLeverRawJob = (
  rawOverrides: Record<string, unknown> = {},
  company = faker.company.name(),
): RawJob => ({
  source: 'lever',
  company,
  raw: {
    id: faker.string.uuid(),
    text: 'Software Engineer',
    hostedUrl: faker.internet.url(),
    categories: {
      location: faker.location.city(),
      team: faker.commerce.department(),
    },
    createdAt: faker.date.recent().getTime(),
    ...rawOverrides,
  },
});

/**
 * Builds a complete Ashby `RawJob` ready to be passed to `normalize`.
 */
export const fakeAshbyRawJob = (
  rawOverrides: Record<string, unknown> = {},
  company = faker.company.name(),
): RawJob => ({
  source: 'ashby',
  company,
  raw: {
    id: faker.string.uuid(),
    title: 'Software Engineer',
    locationName: faker.location.city(),
    jobUrl: faker.internet.url(),
    workplaceType: 'OnSite',
    departmentName: faker.commerce.department(),
    publishedAt: faker.date.recent().toISOString(),
    ...rawOverrides,
  },
});

/**
 * Builds a complete Workday `RawJob` ready to be passed to `normalize`.
 * The `__baseUrl` field is injected by the Workday fetcher at fetch time.
 */
export const fakeWorkdayRawJob = (
  rawOverrides: Record<string, unknown> = {},
  company = faker.company.name(),
): RawJob => ({
  source: 'workday',
  company,
  raw: {
    title: 'Software Engineer',
    externalPath: `/en-US/jobs/${faker.string.alphanumeric(8)}_${faker.string.uuid()}`,
    locationsText: faker.location.city(),
    jobReqId: faker.string.alphanumeric(8),
    __baseUrl: 'https://acme.wd5.myworkdayjobs.com',
    ...rawOverrides,
  },
});
