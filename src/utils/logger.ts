/**
 * Development-only logger utility.
 * Provides console-like logging that only outputs in development mode.
 * All logs are stripped in production builds for cleaner console output.
 */

const isDev = import.meta.env.DEV;

type LogLevel = "log" | "info" | "warn" | "error" | "debug";

interface Logger {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

function createLogger(prefix?: string): Logger {
  const formatArgs = (args: unknown[]): unknown[] => {
    if (prefix) {
      return [`[${prefix}]`, ...args];
    }
    return args;
  };

  const createLogFn = (level: LogLevel) => {
    return (...args: unknown[]) => {
      if (isDev) {
        console[level](...formatArgs(args));
      }
    };
  };

  return {
    log: createLogFn("log"),
    info: createLogFn("info"),
    warn: createLogFn("warn"),
    error: createLogFn("error"),
    debug: createLogFn("debug"),
  };
}

export const logger = createLogger();

export function createModuleLogger(moduleName: string): Logger {
  return createLogger(moduleName);
}

export const updateLogger = createModuleLogger("Update");
