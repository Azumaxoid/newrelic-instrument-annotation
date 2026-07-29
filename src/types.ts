export interface LoggerLike {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface InstrumentServiceOptions {
  logger?: LoggerLike;
}

const consoleLogger: LoggerLike = {
  info: (message, meta) => console.info(message, meta ?? ''),
  warn: (message, meta) => console.warn(message, meta ?? ''),
  error: (message, meta) => console.error(message, meta ?? ''),
};

export function resolveLogger(options?: InstrumentServiceOptions): LoggerLike {
  return options?.logger ?? consoleLogger;
}
