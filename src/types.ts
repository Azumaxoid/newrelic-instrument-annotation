/**
 * Minimal logger interface that this package depends on. Any logger
 * implementation (e.g. pino, winston, or a custom wrapper) can be injected
 * as long as it satisfies this shape.
 *
 * このパッケージが依存する最小限のLoggerインターフェース。
 * このシグネチャを満たすロガー実装(pino/winston/独自ラッパー等)であれば
 * 何でも注入可能。
 */
export interface LoggerLike {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Options accepted by InstrumentService / instrumentServiceClass / instrumentMethod.
 *
 * InstrumentService / instrumentServiceClass / instrumentMethod が受け取るオプション。
 */
export interface InstrumentServiceOptions {
  logger?: LoggerLike;
}

const consoleLogger: LoggerLike = {
  info: (message, meta) => console.info(message, meta ?? ''),
  warn: (message, meta) => console.warn(message, meta ?? ''),
  error: (message, meta) => console.error(message, meta ?? ''),
};

/**
 * Resolves the logger to use: the one passed via options, or `console` as a fallback.
 *
 * 使用するLoggerを解決する。optionsで渡されたものがあればそれを使い、
 * 未指定時はconsoleにフォールバックする。
 */
export function resolveLogger(options?: InstrumentServiceOptions): LoggerLike {
  return options?.logger ?? consoleLogger;
}
