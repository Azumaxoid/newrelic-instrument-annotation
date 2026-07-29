import newrelic from 'newrelic';
import { resolveLogger } from './types';
import type { InstrumentServiceOptions } from './types';
import { stringifyArgsForTelemetry } from './telemetryRedaction';

/**
 * New Relic custom instrumentation for service classes
 * Automatically traces all methods in specified service classes
 */

interface ServiceClass {
  new (...args: unknown[]): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- must accept any real class's prototype shape for runtime reflection
  prototype: any;
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

/**
 * 同一クラス内で計装済みメソッドが計装済みメソッドを呼ぶ場合(例: post → executePost)、
 * 1つのエラーが呼び出しチェーンを巻き戻る際に各階層でnoticeErrorされ、New Relic上で
 * 同じエラーが複数件のイベントとして重複記録されてしまう。同一Errorオブジェクトの
 * 再報告をWeakSetで防ぎ、最も内側の層でのみ報告する(新規にラップされた別のErrorは
 * 別オブジェクトなので意図通り報告される)。
 */
const reportedErrors = new WeakSet<object>();

/**
 * ホストアプリケーションがAPIハンドラーの最外周でエラーを捕捉した際、
 * `e.reported` が立っていなければ自前で `newrelic.noticeError` を呼ぶような、
 * サービス層で報告されなかったエラーを取りこぼさないための仕組みと連携するため、
 * この自動計装で報告済みのエラーには `reported = true` を立てて、最外周での再報告を防ぐ。
 */
function markReported(error: unknown): void {
  if (typeof error !== 'object' || error === null) {
    return;
  }
  try {
    (error as { reported?: boolean }).reported = true;
  } catch {
    // reportedプロパティを持てない(frozen等)エラーオブジェクトは無視する
  }
}

function noticeErrorOnce(error: unknown, attributes: Record<string, string | number | boolean>): void {
  const isObject = typeof error === 'object' && error !== null;
  if (!isObject || !reportedErrors.has(error)) {
    if (isObject) {
      reportedErrors.add(error);
    }
    newrelic.noticeError(error as Error, attributes);
  }
  markReported(error);
}

/**
 * Instruments all methods of a service class with New Relic tracing
 */
export function instrumentServiceClass<T extends ServiceClass>(ServiceClass: T, serviceName: string, options?: InstrumentServiceOptions): T {
  const logger = resolveLogger(options);

  if (typeof newrelic === 'undefined') {
    logger.warn('New Relic not available, skipping instrumentation', { serviceName });
    return ServiceClass;
  }

  try {
    // Get all method names from the prototype
    const methodNames = Object.getOwnPropertyNames(ServiceClass.prototype)
      .filter(name => {
        // Skip constructor and private methods (starting with _)
        if (name === 'constructor' || name.startsWith('_')) {
          return false;
        }

        // Only instrument functions
        const descriptor = Object.getOwnPropertyDescriptor(ServiceClass.prototype, name);
        return descriptor && typeof descriptor.value === 'function';
      });

    logger.info('Instrumenting service methods', { serviceName, methodNames });

    // Instrument each method
    methodNames.forEach(methodName => {
      const originalMethod = ServiceClass.prototype[methodName] as (...args: unknown[]) => unknown;

      ServiceClass.prototype[methodName] = function(...args: unknown[]) {
        const segmentName = `${serviceName}/${methodName}`;

        return newrelic.startSegment(segmentName, true, () => {
          try {
            const result = originalMethod.apply(this, args);

            // Handle async methods (Promise-based)
            if (isPromiseLike(result)) {
              return result.catch((error: Error) => {
                noticeErrorOnce(error, {
                  service: serviceName,
                  method: methodName,
                  args: stringifyArgsForTelemetry(args)
                });
                throw error;
              });
            }

            return result;
          } catch (error) {
            noticeErrorOnce(error, {
              service: serviceName,
              method: methodName,
              args: stringifyArgsForTelemetry(args)
            });
            throw error;
          }
        });
      };
    });

    logger.info('Successfully instrumented service', {
      serviceName,
      methodCount: methodNames.length
    });

  } catch (error) {
    logger.error('Failed to instrument service', {
      serviceName,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return ServiceClass;
}

/**
 * Decorator for automatic service instrumentation
 */
export function InstrumentService(serviceName: string, options?: InstrumentServiceOptions) {
  return function<T extends ServiceClass>(constructor: T): T {
    return instrumentServiceClass(constructor, serviceName, options) as T;
  };
}

/**
 * Manual method instrumentation for specific methods
 */
export function instrumentMethod(target: Record<string, unknown>, methodName: string, serviceName: string, options?: InstrumentServiceOptions) {
  const logger = resolveLogger(options);
  const originalMethod = target[methodName];

  if (typeof originalMethod !== 'function') {
    logger.warn('Method is not a function, skipping instrumentation', {
      serviceName,
      methodName
    });
    return;
  }

  target[methodName] = function(...args: unknown[]) {
    const segmentName = `${serviceName}/${methodName}`;

    return newrelic.startSegment(segmentName, true, () => {
      try {
        const result = (originalMethod as (...args: unknown[]) => unknown).apply(this, args);

        // Handle async methods
        if (isPromiseLike(result)) {
          return result.catch((error: Error) => {
            noticeErrorOnce(error, {
              service: serviceName,
              method: methodName
            });
            throw error;
          });
        }

        return result;
      } catch (error) {
        noticeErrorOnce(error, {
          service: serviceName,
          method: methodName
        });
        throw error;
      }
    });
  };
}

/**
 * Batch instrument multiple service classes
 */
export function instrumentServices(options?: InstrumentServiceOptions) {
  const logger = resolveLogger(options);
  // This will be called after all services are loaded
  logger.info('Batch instrumentation completed');
}
