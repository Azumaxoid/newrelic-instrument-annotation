# @azumaxoid/newrelic-instrument-annotation

## 0.2.0

### Minor Changes

- aedee79: Stop automatically sending method arguments as New Relic error attributes, even when an error is reported. Add a new `@CollectAttributes` method decorator to explicitly opt specific arguments into attribute collection, with an optional per-attribute SHA-256 hash and a `when: 'error' | 'always'` option to control whether attributes are attached only on error or also to every call via `newrelic.addCustomAttributes`.

  **Breaking change:** `instrumentServiceClass`/`instrumentMethod` no longer include an `args` attribute (built from `stringifyArgsForTelemetry`) when calling `newrelic.noticeError`. `stringifyArgsForTelemetry` itself is unchanged and remains available as a standalone utility.

## 0.1.0

### Minor Changes

- 40ea3dd: Initial release of the `InstrumentService` decorator and `stringifyArgsForTelemetry` utility, extracted from nrdojo-web's `newrelic-shim.ts` / `telemetryRedaction.ts`.
