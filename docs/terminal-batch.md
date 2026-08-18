# Terminal batch projection

`TerminalBatch` is the compact projection used where a consumer needs a bounded terminal summary:

```ts
{
  value: string;
  overflow: number;
  records: readonly {
    source: "pi" | "subagent";
    generation: number;
    eventId: number;
    outcome: "completed" | "failed" | "cancelled";
  }[];
}
```

Use `encodeTerminalBatch(values, overflow?)` to construct a canonical batch from terminal wire DTOs, or `parseTerminalBatch(value, overflow?)` to validate an existing projection. Both return frozen data; `encodeTerminalBatch` throws `TypeError` for invalid input, while `parseTerminalBatch` returns `undefined`.

## Canonical grammar

`value` is the comma-separated, lexically canonical form of zero to three records:

```text
record = source ":" generation ":" eventId ":" outcome
source = "pi" | "subagent"
generation = canonical decimal integer in 0..1,000,000
eventId = canonical decimal integer in 0..1,000,000
outcome = "completed" | "failed" | "cancelled"
```

There are no spaces. The empty string represents no records. Both `generation` and `eventId` are integers in `0..1,000,000`; their decimal spellings have no leading zero except `0`. `value` is at most 128 UTF-8 bytes. `overflow` is an integer in `0..1,000,000` and is not encoded into `value`.

Records are sorted by `source`, then numeric `generation`, numeric `eventId`, and `outcome`. `pi` consequently sorts before `subagent`. A `(source, generation, eventId)` tuple may occur only once; conflicting outcomes are also rejected.

For example, these two terminal DTOs encode to the normative batch:

```ts
{
  value: "pi:1:1:completed,subagent:1:1:failed",
  overflow: 0,
  records: [
    { source: "pi", generation: 1, eventId: 1, outcome: "completed" },
    { source: "subagent", generation: 1, eventId: 1, outcome: "failed" },
  ],
}
```

The records are derived from valid terminal DTOs; their `version`, `sessionEpoch`, and `sequence` are deliberately not represented in the projection. See [`fixtures/normative.json`](../fixtures/normative.json) for the canonical fixture.

## Consumer guidance

Deduplicate projected terminal edges by the full tuple `(source, generation, eventId)` in local UI state. Do not reinterpret `eventId` as a persistent identity or use the batch to recover missed events. Values outside the grammar, noncanonical ordering, duplicate tuples, oversized values, or invalid overflow must be ignored.
