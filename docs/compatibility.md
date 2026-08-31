# Compatibility and release boundary

The current coordinated disposition and local validation evidence are in [`completion-audit.md`](completion-audit.md).

## Canonical release

The canonical shared-protocol package is `@pi/presence` from repository [`spi-ca/pi-presence`](https://github.com/spi-ca/pi-presence). [`v2-20260828-1`](https://github.com/spi-ca/pi-presence/tree/v2-20260828-1) is the canonical published release of the corrected package. Release references use an immutable tag/tree URL rather than a mutable branch URL, and a published tag is never moved or recreated. Historical published tags are listed in [`release-history.md`](release-history.md). The public protocol version remains `2`.

The only presence channels are:

```text
pi-presence:state:v2
pi-presence:terminal:v2
pi-presence:withdraw:v2
pi-presence:consumer-ready:v2
```

## V2-only integration

This protocol has no V1 parser, capability, channel, fixture, fallback, dual publication, or compatibility window. Producers and consumers must move together to the same `@pi/presence` release and shared V2 contract. A consumer must not infer V2 data from legacy strings, and a producer must not publish an alternate legacy event.

Same-realm code is trusted; the registry does not authenticate it. Its private ABI-generation fence is not authentication and detects known ABI3/ABI4 version skew only. If a known different ABI release initialized the same-runtime global registry first, handle creation fails closed rather than accepting that stale implementation. Coordinated same-release pinning is release policy, not a property proven by the fence. This private fence does not change protocol version `2`, any V2 channel name, DTO schema, or ready capability.

### Historical ABI3 fixture provenance

[`test/fixtures/registry-abi3-v2-20260820-1.ts`](../test/fixtures/registry-abi3-v2-20260820-1.ts) is an executable copy of `src/registry.ts` from immutable annotated tag [`v2-20260820-1`](https://github.com/spi-ca/pi-presence/tree/v2-20260820-1) (tag object `6aec2f339f390663ee0ea5fd8a1f04edf4466619`, commit `33d1a7ee51eb1c8a399a101017c7bc454a158db2`). It retains the historical ABI3 facade behavior solely for load-order testing. The tests invoke both historical and current exported handle-creation functions in each order; the fixture is not production code.

Compatibility is deliberately limited to the documented V2 schema and export surface. The registry accepts only the two listed consumer IDs, the closed source/state/reason/outcome enums, exact ready capabilities, valid epochs, and strict DTO shapes. Unknown fields or values fail closed rather than being carried forward for a later protocol version.

## Runtime and transport scope

The package is same-runtime and event-driven. It does not define a socket, RPC method, CLI, persistent subscription, polling loop, timer, daemon, storage format, or inter-process authentication mechanism. Consumers that project the data into another transport must validate and bound their own projection and must not expose `sessionEpoch` or privacy-bearing content.

`sessionEpoch` is a consumer-local routing/freshness fence, not a stable ID or credential. `eventId` is a bounded terminal ordinal within a source/generation, not a global correlation ID. These constraints apply even when a downstream UI has different local persistence or notification policies.

## Upgrade checks

A coordinated V2 release should verify all of the following:

- imports pin `@pi/presence` to the same coordinated canonical release, [`v2-20260828-1`](https://github.com/spi-ca/pi-presence/tree/v2-20260828-1);
- all four V2 channel names and the exact three ready capabilities are preserved;
- producer-first retained-state replay and consumer-first live delivery work over a synchronous bus;
- malformed, delayed, forged, duplicate, and cross-consumer payloads fail closed;
- withdrawals fence same-generation state and terminal data, while a higher-generation state starts a new lifecycle;
- terminal projection accepts only canonical batches; and
- observers do not receive raw question, prompt, task, path, tool, error, credential, or run data.

The normative fixture and executable package tests are the compatibility oracle for example DTOs and parser behavior.
