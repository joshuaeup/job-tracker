/**
 * Returns today's date as a YYYY-MM-DD string in UTC.
 */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
