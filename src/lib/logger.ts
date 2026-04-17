/** ANSI color codes for terminal output. GitHub Actions supports these natively. */
const COLOR = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

const LEVEL_FORMAT = {
  info: `${COLOR.cyan}INFO ${COLOR.reset}`,
  warn: `${COLOR.yellow}WARN ${COLOR.reset}`,
  error: `${COLOR.red}ERROR${COLOR.reset}`,
} as const;

type Level = keyof typeof LEVEL_FORMAT;

function timestamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

function formatStage(stage: string): string {
  return `${COLOR.bold}[${stage.toUpperCase().padEnd(7)}]${COLOR.reset}`;
}

function formatMessage(stage: string, level: Level, message: string): string {
  return `${COLOR.gray}[${timestamp()}]${COLOR.reset} ${formatStage(stage)} ${LEVEL_FORMAT[level]} ${message}`;
}

/** A stage-scoped logger that prefixes every line with a timestamp and stage name. */
export type Logger = {
  /** Log an informational message. */
  info: (message: string) => void;
  /** Log a warning — something unexpected but non-fatal. */
  warn: (message: string) => void;
  /** Log an error — something failed and may need attention. */
  error: (message: string, cause?: unknown) => void;
};

/**
 * Creates a logger scoped to a pipeline stage (e.g. "FETCH", "EVAL").
 * Output format: `[HH:MM:SS] [STAGE  ] LEVEL  message`
 *
 * @param stage - Short stage identifier shown in every log line.
 */
export function createLogger(stage: string): Logger {
  return {
    info(message: string): void {
      console.log(formatMessage(stage, 'info', message));
    },

    warn(message: string): void {
      console.warn(formatMessage(stage, 'warn', message));
    },

    error(message: string, cause?: unknown): void {
      const suffix =
        cause instanceof Error
          ? ` — ${cause.message}`
          : cause !== undefined
            ? ` — ${typeof cause === 'string' ? cause : JSON.stringify(cause)}`
            : '';

      console.error(formatMessage(stage, 'error', `${message}${suffix}`));
    },
  };
}
