import { jest } from '@jest/globals';

import { createLogger } from './logger.js';

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('createLogger', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('info', () => {
    it('calls console.log with the message', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const log = createLogger('TEST');

      log.info('hello world');

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toContain('hello world');
    });
  });

  describe('warn', () => {
    it('calls console.warn with the message', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const log = createLogger('TEST');

      log.warn('something odd');

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toContain('something odd');
    });
  });

  describe('error', () => {
    it('appends the Error message when cause is an Error instance', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const log = createLogger('TEST');

      log.error('operation failed', new Error('disk full'));

      expect(spy.mock.calls[0]?.[0]).toContain('disk full');
    });

    it('appends the string directly when cause is a string', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const log = createLogger('TEST');

      log.error('operation failed', 'timeout');

      expect(spy.mock.calls[0]?.[0]).toContain('timeout');
    });

    it('appends JSON when cause is a plain object', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const log = createLogger('TEST');

      log.error('operation failed', { code: 503 });

      expect(spy.mock.calls[0]?.[0]).toContain('503');
    });

    it('omits the suffix when cause is undefined', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const log = createLogger('TEST');

      log.error('plain error');

      expect(spy.mock.calls[0]?.[0]).not.toContain(' — ');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('includes the stage name in every log line', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const log = createLogger('ENRICH');

      log.info('test');

      expect(spy.mock.calls[0]?.[0]).toContain('ENRICH');
    });
  });
});
