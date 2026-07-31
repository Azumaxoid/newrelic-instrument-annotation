# @azumaxoid/newrelic-instrument-annotation

A decorator-based utility that applies New Relic APM auto-instrumentation
(per-method segment tracing + error notification) to TypeScript service classes.

## Features

- Automatically wraps every public method of a class with `newrelic.startSegment`
- Supports both synchronous methods and methods returning a `Promise`
- Automatically calls `newrelic.noticeError` when an exception is thrown
- Prevents duplicate reporting of the same error when one instrumented method
  calls another instrumented method on the same class (e.g. `post` → `executePost`)
- Method arguments are **not** collected as attributes automatically, even when
  an error is reported. Use the `@CollectAttributes` decorator to opt specific
  arguments in explicitly, with an optional per-attribute SHA-256 hash.

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

### Collecting method arguments as attributes (`@CollectAttributes`)

By default, no method argument is sent to New Relic — not even when an error
is reported. This is a deliberate security-driven default: earlier versions
sent every argument automatically, which risked leaking PII/secrets into
error attributes. To opt specific arguments in explicitly, add
`@CollectAttributes` to a method. Entries are mapped **positionally** to the
method's arguments (the first entry corresponds to the first argument, and so
on).

**Example use case:** correlate errors by user without exposing PII, by
hashing the identifier instead of sending it as-is:

```typescript
class UserService {
  @CollectAttributes([{ name: 'userIdHash', hash: true }])
  async fetchUser(userId: string) {
    // ...
  }
}
```

`userIdHash` lets you group/search errors for the same user in New Relic
without the raw `userId` ever leaving the process.

```typescript
import { InstrumentService, CollectAttributes } from '@azumaxoid/newrelic-instrument-annotation';

@InstrumentService('UserService')
class UserService {
  @CollectAttributes(['userId', { name: 'email', hash: true }])
  async fetchUser(userId: string, email: string) {
    // ...
  }
}
```

- A plain string (e.g. `'userId'`) uses that string as both the source
  position's label and the resulting New Relic attribute name, with no hashing.
- An object (`{ name: string, hash?: boolean }`) lets you rename the attribute
  and/or hash its value.
- `hash: true` replaces the value with its SHA-256 hex digest before sending it.
- Arguments that are `undefined`/`null` at a declared position are omitted
  from the resulting attributes.

By default (`when: 'error'`), declared attributes are attached only to the
`noticeError` call made when the method throws or its returned `Promise`
rejects. Pass `{ when: 'always' }` to also attach them to the current
transaction via `newrelic.addCustomAttributes` on every call, regardless of
success or failure:

```typescript
class UserService {
  @CollectAttributes(['userId'], { when: 'always' })
  async fetchUser(userId: string) {
    // ...
  }
}
```

### Using `stringifyArgsForTelemetry` directly (masking utility)

`stringifyArgsForTelemetry` is a standalone masking + serialization utility.
It is no longer called automatically by the instrumentation wrapper — use it
yourself if you need to log/serialize arguments elsewhere.

```typescript
import { stringifyArgsForTelemetry } from '@azumaxoid/newrelic-instrument-annotation';

stringifyArgsForTelemetry([{ token: 'secret-value', name: 'ok' }]);
// => '[{"token":"[REDACTED]","name":"ok"}]'
```

Note: unlike the key-name masking above, `@CollectAttributes` does **not**
apply any automatic masking — it trusts that you only declare attributes that
are safe to send (use `hash: true` if a value still needs protecting).

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
- `CollectAttributes(attributes: AttributeDefinition[], options?: CollectAttributesOptions)` — method decorator that opts specific arguments into attribute collection (positional mapping, optional per-attribute SHA-256 hashing, `when: 'error' | 'always'`)
- `stringifyArgsForTelemetry(args: unknown[], maxLength?: number): string` — argument masking + JSON stringification (standalone utility)
- `LoggerLike` / `InstrumentServiceOptions` — type definitions
- `AttributeDefinition` / `CollectAttributesOptions` / `AttributeCollectionWhen` — type definitions for `@CollectAttributes`

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
