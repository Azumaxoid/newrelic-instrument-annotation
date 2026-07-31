---
"@azumaxoid/newrelic-instrument-annotation": minor
---

Allow `null` entries in `@CollectAttributes`'s `attributes` array to explicitly skip a positional argument (e.g. a leading `session` object) while keeping later entries correctly aligned with their corresponding argument. This is a backward-compatible addition; existing string/object-only arrays are unaffected.

Also export `getAttributeCollectionConfig` and `collectAttributesFromArgs` (plus the `AttributeCollectionConfig`/`NormalizedAttributeDefinition` types) from the package's public entry point, so other instrumentation layers (e.g. a host application's own OpenTelemetry shim) can reuse the same `@CollectAttributes` declarations to build an identical, safe attribute set instead of maintaining a separate/duplicated policy.
