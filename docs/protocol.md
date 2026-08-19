# Presence protocol V2

This document defines the shared, same-runtime presence protocol. Every accepted DTO is copied into an owned, frozen record. Protocol version is always `2`.

## Channels and participants

| Constant | Channel | Payload |
| --- | --- | --- |
| `EVENT_NAMES.state` | `pi-presence:state:v2` | `PresenceStateV2` |
| `EVENT_NAMES.terminal` | `pi-presence:terminal:v2` | `PresenceTerminalV2` |
| `EVENT_NAMES.withdraw` | `pi-presence:withdraw:v2` | `PresenceWithdrawV2` |
| `EVENT_NAMES.consumerReady` | `pi-presence:consumer-ready:v2` | `ConsumerReadyV2` |

Consumers are `pi-cmux-presence` and `pi-herdr-presence`. Their ordered capability list is `presence-state-v2`, `presence-terminal-v2`, and `presence-withdraw-v2`. Producers use one of `pi`, `todo`, `subagent`, or `interaction` as the source.

## Common rules

All numeric counters are safe integers in `0..1_000_000`. `sessionEpoch` is exactly a canonical base64url encoding of 24 bytes (32 characters). It is an opaque per-consumer routing and freshness fence, not authentication and not a value to display, persist, or project outside the same runtime.

Parsers accept only own, enumerable data properties on ordinary objects (or null-prototype records). They reject unknown keys, inherited values, accessors, symbols, proxies, sparse arrays, invalid bounds, and invalid semantic combinations. Successful parse results and nested DTOs are frozen.

Producer input DTOs are epoch-neutral: they must not contain `sessionEpoch`. The registry tags producer data with a consumer epoch before delivery. Wire DTOs must contain the epoch.

## DTOs

### State

```ts
{
  version: 2;
  sessionEpoch: string; // wire only
  generation: number;
  sequence: number;
  source: "pi" | "todo" | "subagent" | "interaction";
  state: "idle" | "waiting" | "running" | "success" | "error" | "cancelled";
  progress?: { completed: number; total: number };
  attention?: { reason: "input_required" | "blocked" | "failure"; occurrence: "new" | "retained" };
  interaction?: { kind: "ask_user"; pending: number };
  subagents?: { running: number; cancelling: number; queued: number; completed: number; failed: number; cancelled: number; omitted: number };
}
```

`progress.total` is at least `1`, and `completed <= total`. `interaction` is permitted only for `interaction` / `waiting`, requires `input_required` attention, and excludes progress and subagent summary. `input_required` is otherwise invalid. `blocked` requires `pi` or `subagent` with `waiting`. `failure` requires `pi` or `subagent` with `error`; a `subagent` non-error state may instead use explicit `failure` attention when it includes the exact seven-field `subagents` aggregate. That aggregate is authoritative for this exception, so `failed: 0` remains valid. `subagents` is permitted only for the `subagent` source.

The registry changes an emitted retained state's `attention.occurrence` to `retained` during replay. Consumers must treat retained state as a state update, not a new edge.

### Terminal and withdrawal

```ts
// terminal
{ version: 2; sessionEpoch: string; generation: number; sequence: number;
  source: "pi" | "subagent"; eventId: number;
  outcome: "completed" | "failed" | "cancelled"; }

// withdrawal
{ version: 2; sessionEpoch: string; generation: number; sequence: number;
  source: "pi" | "todo" | "subagent" | "interaction"; }
```

`eventId` is a bounded terminal ordinal, not a run ID, UUID, hash, timestamp, or general correlation key. Terminal events are live-only; they are not retained or replayed. A withdrawal has no state, display, progress, attention, or terminal fields.

### Consumer-ready

```ts
{
  version: 2;
  sessionEpoch: string;
  consumer: {
    id: "pi-cmux-presence" | "pi-herdr-presence";
    capabilities: ["presence-state-v2", "presence-terminal-v2", "presence-withdraw-v2"];
  };
}
```

The capability list is fixed and ordered. Consumer-ready announces a live consumer and is also the replay boundary; it is emitted synchronously only after the consumer is registered.

## Privacy and authority

The protocol carries no question/option/answer content, prompt, task, path, tool argument or output, raw error, credential, producer label, session path, or run/agent identifier. Consumers derive presentation locally from the closed enums and numeric summaries.

It is observer-only. Delivery, parser, serialization, or consumer failures must not alter Pi lifecycle, interaction answers, cancellation, retry, or other execution authority.
