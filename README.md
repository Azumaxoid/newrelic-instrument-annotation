# @azumaxoid/newrelic-instrument-annotation

A decorator-based utility that applies New Relic APM auto-instrumentation
(per-method segment tracing + error notification) to TypeScript service classes.

## Features

- Automatically wraps every public method of a class with `newrelic.startSegment`
- Supports both synchronous methods and methods returning a `Promise`
- Automatically calls `newrelic.noticeError` when an exception is thrown
- Prevents duplicate reporting of the same error when one instrumented method
  calls another instrumented method on the same class (e.g. `post` → `executePost`)
- Automatically masks keys containing `token`/`password`/`secret`/`email` when
  sending method arguments as New Relic error attributes

## Installation

```bash
npm install @azumaxoid/newrelic-instrument-annotation
```

`newrelic` (the New Relic Node.js agent) is a `peerDependency`. This package
uses the `newrelic` package (`^14.1.2`) already installed in the host
application.

## Usage

### As a class decorator (`@InstrumentService`)

```typescript
import { InstrumentService } from '@azumaxoid/newrelic-instrument-annotation';

@InstrumentService('MyService')
class MyService {
  async fetchData(id: string) {
    // ...
  }
}
```

### Logger injection

By default, internal logs are written to `console`, but you can inject any
logger of your own. Any object implementing `info`/`warn`/`error` methods
(`LoggerLike`) can be used.

```typescript
import { InstrumentService, LoggerLike } from '@azumaxoid/newrelic-instrument-annotation';

const myLogger: LoggerLike = {
  info: (msg, meta) => console.log('[INFO]', msg, meta),
  warn: (msg, meta) => console.warn('[WARN]', msg, meta),
  error: (msg, meta) => console.error('[ERROR]', msg, meta),
};

@InstrumentService('MyService', { logger: myLogger })
class MyService { /* ... */ }
```

### Using `stringifyArgsForTelemetry` directly (masking only)

```typescript
import { stringifyArgsForTelemetry } from '@azumaxoid/newrelic-instrument-annotation';

stringifyArgsForTelemetry([{ token: 'secret-value', name: 'ok' }]);
// => '[{"token":"[REDACTED]","name":"ok"}]'
```

## How it works

- Methods named `constructor` or starting with `_` are excluded from instrumentation.
- When an error is reported, `reported = true` is set on the error object.
  This is intended to be combined with a host application's outermost error
  handler that checks `error.reported` to avoid re-reporting (this package
  itself does not depend on such a handler existing).
- When the same Error object propagates through multiple layers of nested
  instrumented method calls, a `WeakSet` ensures `noticeError` is only called
  from the innermost layer.

## API Reference

- `InstrumentService(serviceName: string, options?: InstrumentServiceOptions)` — class decorator
- `instrumentServiceClass<T>(ServiceClass: T, serviceName: string, options?: InstrumentServiceOptions): T` — the function backing the decorator
- `instrumentMethod(target, methodName, serviceName, options?)` — manual instrumentation of a single method
- `stringifyArgsForTelemetry(args: unknown[], maxLength?: number): string` — argument masking + JSON stringification
- `LoggerLike` / `InstrumentServiceOptions` — type definitions

## Contributing

Please use [Changesets](https://github.com/changesets/changesets) when making changes.

```bash
npx changeset
```

Once a PR containing a `.changeset/*.md` file is merged into `main`, CI will
automatically open a version-bump PR; merging that PR publishes the new
version to npm.

## License

MIT
