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

export const mockWorkdayDetailFailure = (status: number): void => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Internal Server Error',
    // istanbul ignore next — enricher returns '' on !ok without calling .json()
    json: () => Promise.resolve({}),
  } as Response);
};

export const mockWorkdayDetailNetworkError = (): void => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValueOnce(new Error('Network error'));
};
