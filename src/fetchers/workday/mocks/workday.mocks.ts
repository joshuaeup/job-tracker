import { jest } from '@jest/globals';

import type { CompanyConfig } from '../../../types/index.js';

export const makeWorkdayConfig = (
  overrides: Partial<{ name: string; slug: string }> = {},
): CompanyConfig => ({
  name: overrides.name ?? 'Acme Corp',
  ats: 'workday',
  slug: overrides.slug ?? 'acme.wd5/acme/search',
  enabled: true,
});

export const mockFetch = (body: unknown, ok = true, status = 200): void => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok,
    status,
    statusText: ok ? 'OK' : 'Not Found',
    json: () => Promise.resolve(body),
  } as Response);
};
