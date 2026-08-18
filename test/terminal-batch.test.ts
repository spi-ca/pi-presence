import { expect, test } from "bun:test";
import { encodeTerminalBatch, parseTerminalBatch } from "../index.ts";

const epoch = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const terminal = (source: "pi" | "subagent", generation: number, sequence: number, eventId: number, outcome: "completed" | "failed" | "cancelled") => ({ version: 2, sessionEpoch: epoch, source, generation, sequence, eventId, outcome });

test("canonical terminal batches sort, bound, and round trip", () => {
  const batch = encodeTerminalBatch([terminal("subagent", 1, 2, 1, "failed"), terminal("pi", 1, 1, 1, "completed")], 7);
  expect(batch.value).toBe("pi:1:1:completed,subagent:1:1:failed");
  expect(batch.overflow).toBe(7);
  expect(parseTerminalBatch(batch.value, "7")).toBeUndefined();
  expect(parseTerminalBatch(batch.value, 7)).toEqual(batch);
});

test("terminal grammar rejects noncanonical decimal, duplicates, conflicts, and overflow", () => {
  expect(parseTerminalBatch("pi:01:1:completed")).toBeUndefined();
  expect(parseTerminalBatch("pi:1:1:completed,pi:1:1:failed")).toBeUndefined();
  expect(parseTerminalBatch("subagent:1:1:failed,pi:1:1:completed")).toBeUndefined();
  expect(parseTerminalBatch("pi:1:1:completed", 1_000_001)).toBeUndefined();
  expect(() => encodeTerminalBatch([terminal("pi", 1, 1, 1, "completed"), terminal("pi", 1, 2, 1, "completed")])).toThrow();
  expect(() => encodeTerminalBatch([terminal("pi", 1, 1, 1, "completed"), terminal("pi", 1, 2, 2, "completed"), terminal("pi", 1, 3, 3, "completed"), terminal("pi", 1, 4, 4, "completed")])).toThrow();
});

test("batch parser rejects a proxy without traps", () => {
  let traps = 0;
  const hostile = new Proxy([], { get: () => { traps += 1; return undefined; }, ownKeys: () => { traps += 1; return []; } });
  expect(() => encodeTerminalBatch(hostile)).toThrow();
  expect(traps).toBe(0);
});
