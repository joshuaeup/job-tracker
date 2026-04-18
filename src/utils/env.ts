/**
 * Reads a required environment variable, throwing early if it is absent.
 *
 * @param name - The environment variable name
 * @returns The variable's string value
 * @throws {Error} If the variable is not set or is an empty string
 */
export const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};
