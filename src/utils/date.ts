/**
 * Returns today's date as a YYYY-MM-DD string in UTC.
 */
export const today = (): string => new Date().toISOString().slice(0, 10);
