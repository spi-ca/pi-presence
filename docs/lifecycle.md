# Lifecycle, replay, and fences

## Activation order

1. Create a consumer with a supported `id` and optional valid `sessionEpoch`.
2. Install synchronous bus listeners that pass every candidate event to that consumer's `accept(name, payload)`.
3. Call `consumer.activate(emitReady?)`. It registers the consumer, synchronously invokes `emitReady` with `EVENT_NAMES.consumerReady` and `ready`, then replays retained states from active producers.
4. Create a producer with one supported `source` and an `emit(name, event)` callback, then call `producer.activate()`.
5. Publish epoch-neutral state, terminal, or withdrawal inputs. Deactivate the owning handle when finished.

A producer activated after a consumer immediately sees that registered consumer. A consumer activated after a producer receives its retained state. `activate()` returns `false` for an already active source or consumer ID, and `deactivate()` returns `false` for a non-owning or inactive handle.

## Synchronous delivery requirement

For every active consumer, the registry calls the producer emitter with an epoch-tagged frozen wire event. The delivery receipt is private, bound to the exact payload identity, target consumer, producer incarnation, source, and channel name, and exists only while `emit` executes. `accept` consumes it before parsing.

Therefore the event bus **must dispatch synchronously**. A queued or delayed delivery, a replayed captured payload, a payload accepted twice, a payload sent to another consumer, or an independently constructed schema-valid payload is rejected. An emitter exception is best-effort observer failure: it does not undo already coherent retention.

## Retention and replay

Only the latest accepted state per source is retained. A new state replaces it; a withdrawal removes it; producer deactivation also removes it. A replay uses the current target's epoch and changes `attention.occurrence` to `retained`. Terminal events are never retained or replayed.

Each source has one active producer handle and each consumer ID has one active consumer handle. A producer's clean deactivation removes its retained state and ingress fence, and removes that source's fence from active consumers, so a later activation starts a fresh lifecycle.

## Ordering and withdrawal

The registry applies its ingress fence before retention and fanout. Consumers independently apply the same state/terminal/withdrawal ordering fence after receipt validation.

- State and terminal events require a generation greater than the withdrawn generation, and must advance the source's `(generation, sequence)` ordering position.
- Terminal `eventId` also must advance within its terminal generation.
- A withdrawal must advance the existing order and its withdrawal high-water position.
- A state or terminal in the same generation cannot reopen a withdrawn source, regardless of a higher sequence. Only a state in a higher generation opens a new lifecycle.

This makes duplicate, stale, and pre-withdrawal data fail closed. It also means callers must advance generation to begin a lifecycle after a withdrawal.

## Global registry boundary

The registry is one immutable, ABI-branded global facade with closure-private mutable state. If the reserved global slot is incompatible or accessor-backed, creation fails closed. There is no public reset API.

The protocol uses no polling, timers, connections, command execution, persistent daemon, or background work.
