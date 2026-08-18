# API reference

The root export is the complete supported module surface. Protocol-facing constructors, parsers, types, constants, terminal-batch helpers, and strict utility helpers are exported from `index.ts`. All parser successes, build results, handles, ready payloads, and batch results are frozen.

## Constants and value types

| Export | Value |
| --- | --- |
| `EVENT_NAMES` | Frozen channels: `state`, `terminal`, `withdraw`, `consumerReady`. See [`protocol.md`](protocol.md). |
| `CONSUMER_CAPABILITIES` | Ordered fixed tuple: `presence-state-v2`, `presence-terminal-v2`, `presence-withdraw-v2`. |
| `CONSUMER_IDS` | `pi-cmux-presence`, `pi-herdr-presence`. |
| `SOURCES` | `pi`, `todo`, `subagent`, `interaction`. |
| `STATES` | `idle`, `waiting`, `running`, `success`, `error`, `cancelled`. |
| `ATTENTION_REASONS` | `input_required`, `blocked`, `failure`. |
| `TERMINAL_OUTCOMES` | `completed`, `failed`, `cancelled`. |
| `MAX_INTEGER` | `1_000_000`, the inclusive maximum for protocol counters. |

The corresponding types are `PresenceSource`, `PresenceState`, `AttentionReason`, `TerminalOutcome`, `ConsumerId`, and `PresenceCapability`.

## Protocol DTO types

| Export | Meaning |
| --- | --- |
| `Progress` | `{ completed, total }` state progress. |
| `Attention` | `{ reason, occurrence }`, where occurrence is `new` or `retained`. |
| `Interaction` | `{ kind: "ask_user", pending }`. |
| `Subagents` | Numeric `running`, `cancelling`, `queued`, `completed`, `failed`, `cancelled`, and `omitted` aggregate. |
| `PresenceStateInputV2` | Producer state input without an epoch. |
| `PresenceTerminalInputV2` | Producer terminal input without an epoch. |
| `PresenceWithdrawInputV2` | Producer withdrawal input without an epoch. |
| `PresenceStateV2` | Epoch-tagged wire state. |
| `PresenceTerminalV2` | Epoch-tagged wire terminal. |
| `PresenceWithdrawV2` | Epoch-tagged wire withdrawal. |
| `ConsumerReadyV2` | Epoch-tagged, fixed-capability consumer-ready payload. |
| `PresenceEventV2` | Union of the three wire event types. |
| `ProducerSnapshotV2` | Union of the three epoch-neutral producer input types. |
| `TerminalTuple` | `{ source, generation, eventId, outcome }` terminal projection record. |
| `TerminalBatch` | `{ value, overflow, records }` canonical terminal projection. |
| `ProducerEmit` | `(eventName, event) => void` producer callback. |
| `ConsumerReadyEmit` | `(eventName, event) => void` ready callback. |
| `PresenceProducerHandle` | `activate`, `publishState`, `publishTerminal`, `withdraw`, and `deactivate`. |
| `PresenceConsumerHandle` | Frozen `ready`, plus `activate`, `accept`, and `deactivate`. |

Field constraints and permitted state combinations are normative in [`protocol.md`](protocol.md).

## Registry handles

- `createPresenceProducer(value)` accepts exactly `{ source, emit }` and returns `PresenceProducerHandle | undefined`. It returns `undefined` rather than throwing for an invalid producer descriptor or unavailable safe global registry. Its `publish*` methods accept `unknown`, strictly parse epoch-neutral input, and return whether the registry accepted it.
- `createPresenceConsumer(value)` accepts `{ id, sessionEpoch? }` and returns `PresenceConsumerHandle | undefined`. A supplied epoch must be valid; otherwise the registry creates one. `activate(emitReady?)` synchronously emits ready and replays retained state after registration. `accept(eventName, payload)` returns the accepted wire event or `undefined`.

See [`lifecycle.md`](lifecycle.md) for ownership, replay, synchronous receipt, and fencing requirements.

## Strict schema parsers and builders

The `parse*` helpers return a frozen typed DTO or `undefined`; they do not coerce, project, or preserve unknown data. The matching `build*` helper applies the same parser but throws `TypeError` when validation fails.

| Wire DTO | Parser | Throwing builder |
| --- | --- | --- |
| State | `parsePresenceStateV2` | `buildPresenceStateV2` |
| Terminal | `parsePresenceTerminalV2` | `buildPresenceTerminalV2` |
| Withdrawal | `parsePresenceWithdrawV2` | `buildPresenceWithdrawV2` |
| Consumer-ready | `parseConsumerReadyV2` | `buildConsumerReadyV2` |

For producer inputs without `sessionEpoch`, use `parsePresenceStateInputV2` / `buildPresenceStateInputV2`, `parsePresenceTerminalInputV2` / `buildPresenceTerminalInputV2`, or `parsePresenceWithdrawInputV2` / `buildPresenceWithdrawInputV2`. Input parsers reject an epoch; wire parsers require one.

`isSessionEpoch(value)` is a type guard for canonical 24-byte base64url epochs. `createSessionEpoch()` returns a newly generated valid epoch.

## Terminal batches

- `encodeTerminalBatch(values, overflow?)` accepts at most three valid terminal wire DTOs, validates and canonicalizes them, and returns `TerminalBatch`; invalid values throw `TypeError`.
- `parseTerminalBatch(value, overflow?)` validates canonical projection text and returns `TerminalBatch | undefined`.

The grammar, ordering, bounds, and records are specified in [`terminal-batch.md`](terminal-batch.md).

## Exported strict helpers

`isInteger`, `ownDataRecord`, `denseArray`, `fixedStringArray`, and `frozen` are exported strict validation primitives used by the schema and batch implementation. They are not lenient conversion or general object-normalization APIs:

- `isInteger(value, minimum?)` accepts only safe integers from `minimum` (default `0`) through `MAX_INTEGER`.
- `ownDataRecord(value, keys, required?)` accepts only a non-proxy ordinary/null-prototype object with exactly allowed own enumerable data keys; `required` defaults to `keys`.
- `denseArray(value, maximum)` accepts only a non-proxy ordinary dense array with at most `maximum` items.
- `fixedStringArray(value, expected)` checks a non-proxy ordinary dense array for exact length and exact ordered string values.
- `frozen(value)` is the exported `Object.freeze` wrapper.

These helpers do not recursively validate arbitrary application data. Use the DTO parsers/builders for protocol values.
