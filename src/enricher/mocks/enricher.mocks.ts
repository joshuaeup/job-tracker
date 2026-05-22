import { jest } from '@jest/globals';

export const mockWorkdayDetail = (description: string): void => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () =>
      Promise.resolve({ jobPostingInfo: { jobDescription: description } }),
  } as Response);
};

export const mockWorkdayDetailFailure = (status = 500): void => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Internal Server Error',
    json: () => Promise.resolve({}),
  } as Response);
};
