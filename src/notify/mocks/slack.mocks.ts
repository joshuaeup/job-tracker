import { jest } from '@jest/globals';

/**
 * Stubs a one-shot `fetch` response for the Slack webhook. Returns the spy so
 * callers can inspect what was sent when needed.
 */
export const mockSlackFetch = (
  ok = true,
  status = 200,
): ReturnType<typeof jest.spyOn> =>
  jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok,
    status,
    statusText: ok ? 'OK' : 'Bad Request',
  } as Response);
