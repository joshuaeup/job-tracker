import { requireEnv } from './env.js';

beforeEach(() => {
  delete process.env['TEST_VAR'];
});

describe('requireEnv', () => {
  // ── Success scenarios ──────────────────────────────────────────────────────

  describe('when the variable is set', () => {
    it('returns the value', () => {
      process.env['TEST_VAR'] = 'hello';

      expect(requireEnv('TEST_VAR')).toBe('hello');
    });
  });

  // ── Error states ───────────────────────────────────────────────────────────

  describe('error states', () => {
    it('throws when the variable is not set', () => {
      expect(() => requireEnv('TEST_VAR')).toThrow(
        'Missing required environment variable: TEST_VAR',
      );
    });

    it('throws when the variable is an empty string', () => {
      process.env['TEST_VAR'] = '';

      expect(() => requireEnv('TEST_VAR')).toThrow('TEST_VAR');
    });
  });
});
