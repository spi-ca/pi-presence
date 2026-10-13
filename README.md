# @pi/presence

Shared, dependency-free V2 presence protocol for same-runtime Pi observers. It emits strict, frozen DTOs and canonical terminal batches; it starts no timers, connections, commands, or background work.

**Canonical coordinated release reference:** [`v2-20261013-1`](https://github.com/spi-ca/pi-presence/tree/v2-20261013-1) is the immutable release target for the Pi 1.2.0 batch. The canonical package is `@pi/presence` in [`spi-ca/pi-presence`](https://github.com/spi-ca/pi-presence). Release references use immutable tag/tree URLs, never mutable branch URLs; published tags are never moved or recreated. Historical tags and release status are recorded in [`docs/release-history.md`](docs/release-history.md). This batch updates release documentation only: runtime source, public protocol version `2`, V2 channels, DTOs, runtime API, and private ABI generation are unchanged from `v2-20261009-1`. The package has no Pi dependency; its Bun CI and package smoke do not establish Pi 1.2.0 host or live terminal acceptance.

## Use

```ts
import { createPresenceConsumer, createPresenceProducer } from "@pi/presence";

const consumer = createPresenceConsumer({ id: "pi-cmux-presence" })!;
const listeners = new Set<(name: string, payload: unknown) => void>();
listeners.add((name, payload) => {
  const accepted = consumer.accept(name, payload);
  if (accepted) render(accepted);
});
consumer.activate((name, ready) => broadcast(name, ready));

const producer = createPresenceProducer({
  source: "pi",
  emit: (name, event) => { for (const listener of listeners) listener(name, event); },
})!;
producer.activate();
producer.publishState({ version: 2, generation: 0, sequence: 0, source: "pi", state: "running" });
```

First install bus listeners that call `accept`, then activate a consumer. Delivery must be synchronous: a private receipt is valid only during the producer's `emit` callback and is consumed by one matching `accept` call. Producers never supply `sessionEpoch`; the registry adds the target consumer epoch to wire events. Epochs are routing/freshness markers, not credentials.

Same-realm code is trusted: this package does not authenticate it. All producers and consumers in one runtime must use the same `@pi/presence` release as a coordinated release-pinning policy. The private ABI-generation fence is not authentication; it detects known ABI3/ABI4 version skew and rejects a different registry rather than delegating to stale behavior. It does not change public V2 channels or DTOs.

Read [`docs/protocol.md`](docs/protocol.md) for wire rules, [`docs/lifecycle.md`](docs/lifecycle.md) for activation and fencing, [`docs/terminal-batch.md`](docs/terminal-batch.md) for projection grammar, [`docs/compatibility.md`](docs/compatibility.md) for release boundaries, [`docs/development.md`](docs/development.md) for local and CI verification, and [`docs/api.md`](docs/api.md) for exports. The normative examples are in [`fixtures/normative.json`](fixtures/normative.json).
