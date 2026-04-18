import { jest } from '@jest/globals';

import type { CompanyConfig } from '../../../types/index.js';

export const makeLeverConfig = (
  overrides: Partial<{ name: string; slug: string }> = {},
): CompanyConfig => ({
  name: overrides.name ?? 'Acme Corp',
  ats: 'lever',
  slug: overrides.slug ?? 'acme',
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
