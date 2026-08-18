# Compatibility and release boundary

## Canonical release

The canonical shared-protocol package is `@pi/presence` from repository [`spi-ca/pi-presence`](https://github.com/spi-ca/pi-presence). [`v2-20260818-2`](https://github.com/spi-ca/pi-presence/tree/v2-20260818-2) is an immutable published release. Release references must use an immutable tag/tree URL rather than a mutable branch URL; once published, a tag is never moved or recreated. The protocol version remains `2`.

The only presence channels are:

```text
pi-presence:state:v2
pi-presence:terminal:v2
pi-presence:withdraw:v2
pi-presence:consumer-ready:v2
```

## V2-only integration

This protocol has no V1 parser, capability, channel, fixture, fallback, dual publication, or compatibility window. Producers and consumers must move together to the same shared V2 contract. A consumer must not infer V2 data from legacy strings, and a producer must not publish an alternate legacy event.

Compatibility is deliberately limited to the documented V2 schema and export surface. The registry accepts only the two listed consumer IDs, the closed source/state/reason/outcome enums, exact ready capabilities, valid epochs, and strict DTO shapes. Unknown fields or values fail closed rather than being carried forward for a later protocol version.

## Runtime and transport scope

The package is same-runtime and event-driven. It does not define a socket, RPC method, CLI, persistent subscription, polling loop, timer, daemon, storage format, or inter-process authentication mechanism. Consumers that project the data into another transport must validate and bound their own projection and must not expose `sessionEpoch` or privacy-bearing content.

`sessionEpoch` is a consumer-local routing/freshness fence, not a stable ID or credential. `eventId` is a bounded terminal ordinal within a source/generation, not a global correlation ID. These constraints apply even when a downstream UI has different local persistence or notification policies.

## Upgrade checks

A coordinated V2 release should verify all of the following:

- imports use `@pi/presence` and the repository/release reference is the immutable tagged tree `spi-ca/pi-presence` / `v2-20260818-2`;
- all four V2 channel names and the exact three ready capabilities are preserved;
- producer-first and consumer-first retained-state replay work over a synchronous bus;
- malformed, delayed, forged, duplicate, and cross-consumer payloads fail closed;
- withdrawals fence same-generation state and terminal data, while a higher-generation state starts a new lifecycle;
- terminal projection accepts only canonical batches; and
- observers do not receive raw question, prompt, task, path, tool, error, credential, or run data.

The normative fixture and executable package tests are the compatibility oracle for example DTOs and parser behavior.
