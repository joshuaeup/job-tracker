import { jest } from '@jest/globals';

import { fakeLeverJob, fakeLeverResponse } from './factories/lever.factory.js';
import { fetchLever } from './lever.js';
import { makeLeverConfig, mockFetch } from './mocks/lever.mocks.js';

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('fetchLever', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('when the API returns job postings', () => {
    it('returns one RawJob per posting with source set to "lever"', async () => {
      const jobs = [fakeLeverJob(), fakeLeverJob()];
      mockFetch(fakeLeverResponse(jobs));

      const result = await fetchLever(makeLeverConfig());

      expect(result).toHaveLength(2);
      expect(result[0]?.source).toBe('lever');
    });

    it('sets the company name from the config on every result', async () => {
      mockFetch(fakeLeverResponse([fakeLeverJob()]));

      const result = await fetchLever(makeLeverConfig({ name: 'Initech' }));

      expect(result[0]?.company).toBe('Initech');
    });

    it('preserves the raw job fields in the raw property', async () => {
      const job = fakeLeverJob({ text: 'Staff Engineer' });
      mockFetch(fakeLeverResponse([job]));

      const result = await fetchLever(makeLeverConfig());

      expect((result[0]?.raw as { text: string }).text).toBe('Staff Engineer');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns an empty array when the API returns no jobs', async () => {
      mockFetch(fakeLeverResponse([]));

      const result = await fetchLever(makeLeverConfig());

      expect(result).toHaveLength(0);
    });

    it('constructs the correct API URL with mode=json', async () => {
      const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(fakeLeverResponse([])),
      } as Response);

      await fetchLever(makeLeverConfig({ slug: 'my-company' }));

      expect(spy).toHaveBeenCalledWith(
        'https://api.lever.co/v0/postings/my-company?mode=json',
      );
    });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  describe('error states', () => {
    it('throws when the HTTP response is not OK', async () => {
      mockFetch({}, false, 404);

      await expect(fetchLever(makeLeverConfig())).rejects.toThrow(
        'Lever fetch failed for Acme Corp: 404',
      );
    });

    it('includes the company name in the error message', async () => {
      mockFetch({}, false, 500);

      await expect(
        fetchLever(makeLeverConfig({ name: 'Globex' })),
      ).rejects.toThrow('Globex');
    });
  });
});
