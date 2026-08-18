# @pi/presence-v2

Dependency-free, same-runtime presence protocol with strict frozen DTOs and canonical terminal batches. It starts no timers, connections, commands, or background work.

## Use

```ts
import { createPresenceConsumer, createPresenceProducer, EVENT_NAMES } from "@pi/presence-v2";

const consumer = createPresenceConsumer({ id: "pi-cmux-presence" })!;
const listeners = new Set<(name: string, payload: unknown) => void>();
listeners.add((name, payload) => {
  const accepted = consumer.accept(name, payload);
  if (accepted) render(accepted);
});
consumer.activate((name, ready) => {
  // version: 2; announce only after listeners above are installed.
  broadcast(name, ready);
});

const producer = createPresenceProducer({
  source: "pi",
  emit: (name, event) => { for (const listener of listeners) listener(name, event); },
})!;
producer.activate();
producer.publishState({ version: 2, generation: 0, sequence: 0, source: "pi", state: "running" });
```

Activation order is: create consumer, install bus listeners that call `accept`, then activate (which synchronously emits consumer-ready and replays retained state). Producers never provide an epoch. The registry adds each consumer's epoch to wire events.

The Pi process event bus **must dispatch synchronously**: each target's private delivery receipt is live only for the `emit` callback and is consumed by one matching `accept` call. Queued, delayed, replayed, or independently constructed payloads fail closed.

Epochs are freshness and routing markers for same-runtime fanout, **not credentials** and not authentication for code in the same process. See [`docs/api.md`](docs/api.md) and [`fixtures/normative.json`](fixtures/normative.json).
