# @azumaxoid/newrelic-instrument-annotation

## 0.3.0

### Minor Changes

- 90cb558: Allow `null` entries in `@CollectAttributes`'s `attributes` array to explicitly skip a positional argument (e.g. a leading `session` object) while keeping later entries correctly aligned with their corresponding argument. This is a backward-compatible addition; existing string/object-only arrays are unaffected.

  Also export `getAttributeCollectionConfig` and `collectAttributesFromArgs` (plus the `AttributeCollectionConfig`/`NormalizedAttributeDefinition` types) from the package's public entry point, so other instrumentation layers (e.g. a host application's own OpenTelemetry shim) can reuse the same `@CollectAttributes` declarations to build an identical, safe attribute set instead of maintaining a separate/duplicated policy.

## 0.2.0

### Minor Changes

- aedee79: Stop automatically sending method arguments as New Relic error attributes, even when an error is reported. Add a new `@CollectAttributes` method decorator to explicitly opt specific arguments into attribute collection, with an optional per-attribute SHA-256 hash and a `when: 'error' | 'always'` option to control whether attributes are attached only on error or also to every call via `newrelic.addCustomAttributes`.

  **Breaking change:** `instrumentServiceClass`/`instrumentMethod` no longer include an `args` attribute (built from `stringifyArgsForTelemetry`) when calling `newrelic.noticeError`. `stringifyArgsForTelemetry` itself is unchanged and remains available as a standalone utility.

## 0.1.0

### Minor Changes

- 40ea3dd: Initial release of the `InstrumentService` decorator and `stringifyArgsForTelemetry` utility, extracted from nrdojo-web's `newrelic-shim.ts` / `telemetryRedaction.ts`.
