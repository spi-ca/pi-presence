# @pi/presence

Shared, dependency-free V2 presence protocol for same-runtime Pi observers. It emits strict, frozen DTOs and canonical terminal batches; it starts no timers, connections, commands, or background work.

**Release identity:** the canonical package is `@pi/presence` in [`spi-ca/pi-presence`](https://github.com/spi-ca/pi-presence), planned for tag `v2-20260818-1`. The protocol version remains `2` and channel names remain V2.

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

Read [`docs/protocol.md`](docs/protocol.md) for wire rules, [`docs/lifecycle.md`](docs/lifecycle.md) for activation and fencing, [`docs/terminal-batch.md`](docs/terminal-batch.md) for projection grammar, [`docs/compatibility.md`](docs/compatibility.md) for release boundaries, and [`docs/api.md`](docs/api.md) for exports. The normative examples are in [`fixtures/normative.json`](fixtures/normative.json).
