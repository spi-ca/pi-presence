import { afterEach, expect, test } from "bun:test";
import * as api from "../index.ts";
import { createPresenceConsumer, createPresenceProducer, EVENT_NAMES } from "../index.ts";

const a = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const b = "_______________________________w";
const active: Array<{ deactivate: () => boolean }> = [];
afterEach(() => { for (const handle of active.splice(0)) handle.deactivate(); });
function producer(source: "pi" | "todo" | "subagent" | "interaction", emit: (name: string, event: unknown) => void) {
  const handle = createPresenceProducer({ source, emit })!; active.push(handle); return handle;
}
function consumer(id: "pi-cmux-presence" | "pi-herdr-presence", sessionEpoch: string) {
  const handle = createPresenceConsumer({ id, sessionEpoch })!; active.push(handle); return handle;
}
const state = (generation = 0, sequence = 0) => ({ version: 2, generation, sequence, source: "pi" as const, state: "running" as const });
const terminal = (generation = 0, sequence = 0, eventId = 0) => ({ version: 2, generation, sequence, source: "pi" as const, eventId, outcome: "completed" as const });
const withdraw = (generation = 0, sequence = 0) => ({ version: 2, generation, sequence, source: "pi" as const });

test("consumer-ready is synchronous and consumer-first activation fans out over a shared bus", () => {
  const bus = new Set<(name: string, payload: unknown) => void>();
  const left = consumer("pi-cmux-presence", a), right = consumer("pi-herdr-presence", b);
  const leftAccepted: unknown[] = [], rightAccepted: unknown[] = [];
  bus.add((name, payload) => { const event = left.accept(name, payload); if (event) leftAccepted.push(event); });
  bus.add((name, payload) => { const event = right.accept(name, payload); if (event) rightAccepted.push(event); });
  const ready: unknown[] = [];
  expect(left.activate((name, payload) => ready.push([name, payload]))).toBe(true);
  expect(right.activate()).toBe(true);
  expect(ready).toHaveLength(1);
  expect((ready[0] as [string, unknown])[0]).toBe(EVENT_NAMES.consumerReady);
  const source = producer("pi", (name, event) => { for (const listener of bus) listener(name, event); });
  expect(source.activate()).toBe(true);
  expect(source.publishState(state())).toBe(true);
  expect(leftAccepted).toHaveLength(1); expect(rightAccepted).toHaveLength(1);
  const accepted = [...leftAccepted, ...rightAccepted];
  expect(new Set(accepted.map(event => (event as { sessionEpoch: string }).sessionEpoch))).toEqual(new Set([a, b]));
  // A per-target receipt means a shared bus delivers each payload to only its intended consumer.
  expect((leftAccepted[0] as { sessionEpoch: string }).sessionEpoch).toBe(a);
  expect((rightAccepted[0] as { sessionEpoch: string }).sessionEpoch).toBe(b);
  for (const event of accepted) expect(left.accept(EVENT_NAMES.state, event)).toBeUndefined();
});

test("late producer sees registered consumers without another ready event", () => {
  const target = consumer("pi-cmux-presence", a); let ready = 0, accepted = 0;
  expect(target.activate(() => { ready += 1; })).toBe(true);
  const source = producer("pi", (name, event) => { if (target.accept(name, event)) accepted += 1; });
  expect(source.activate()).toBe(true);
  expect(source.publishState(state())).toBe(true);
  expect(ready).toBe(1); expect(accepted).toBe(1);
});

test("forged schema-valid events and proxy payloads fail before parsing without advancing fences", () => {
  const target = consumer("pi-cmux-presence", a); const accepted: unknown[] = [];
  expect(target.activate()).toBe(true);
  expect(target.accept(EVENT_NAMES.state, Object.freeze({ ...state(), sessionEpoch: a }))).toBeUndefined();
  let traps = 0;
  const proxied = new Proxy(Object.freeze({ ...state(), sessionEpoch: a }), {
    get: () => { traps += 1; throw new Error("payload reflected"); },
    ownKeys: () => { traps += 1; return []; },
    getOwnPropertyDescriptor: () => { traps += 1; return undefined; },
  });
  expect(target.accept(EVENT_NAMES.state, proxied)).toBeUndefined();
  expect(traps).toBe(0);
  const source = producer("pi", (name, event) => { const acceptedEvent = target.accept(name, event); if (acceptedEvent) accepted.push(acceptedEvent); });
  expect(source.activate()).toBe(true); expect(source.publishState(state())).toBe(true);
  expect(accepted).toHaveLength(1);
});

test("a delivery receipt is target-bound, one-shot, and removed after synchronous emit", () => {
  const target = consumer("pi-cmux-presence", a); const attempts: Array<unknown> = []; let captured: [string, unknown] | undefined;
  expect(target.activate()).toBe(true);
  const source = producer("pi", (name, event) => {
    captured = [name, event];
    attempts.push(target.accept(name, event));
    attempts.push(target.accept(name, event));
  });
  expect(source.activate()).toBe(true); expect(source.publishState(state())).toBe(true);
  expect(attempts[0]).toBeDefined(); expect(attempts[1]).toBeUndefined();
  expect(target.accept(captured![0], captured![1])).toBeUndefined();
});

test("a captured payload from a deactivated producer incarnation cannot poison a fresh fence", () => {
  const target = consumer("pi-cmux-presence", a); let captured: [string, unknown] | undefined; const fresh: unknown[] = [];
  expect(target.activate()).toBe(true);
  const first = producer("pi", (name, event) => { captured = [name, event]; });
  expect(first.activate()).toBe(true); expect(first.publishState(state(4, 4))).toBe(true); expect(first.deactivate()).toBe(true);
  const second = producer("pi", (name, event) => { const accepted = target.accept(name, event); if (accepted) fresh.push(accepted); });
  expect(second.activate()).toBe(true);
  expect(target.accept(captured![0], captured![1])).toBeUndefined();
  expect(second.publishState(state())).toBe(true);
  expect(fresh).toHaveLength(1); expect((fresh[0] as { generation: number }).generation).toBe(0);
});

test("a deactivated and reactivated producer invalidates an in-flight old-incarnation receipt", () => {
  const target = consumer("pi-cmux-presence", a); const fresh: unknown[] = []; let reactivated = false; let stale: unknown;
  expect(target.activate()).toBe(true);
  let source: ReturnType<typeof producer>;
  source = producer("pi", (name, event) => {
    if (!reactivated) {
      reactivated = true;
      expect(source.deactivate()).toBe(true); expect(source.activate()).toBe(true);
      stale = target.accept(name, event);
      return;
    }
    const accepted = target.accept(name, event); if (accepted) fresh.push(accepted);
  });
  expect(source.activate()).toBe(true); expect(source.publishState(state())).toBe(true);
  expect(stale).toBeUndefined();
  expect(source.publishState(state())).toBe(true);
  expect(fresh).toHaveLength(1);
});

test("producer inputs are epoch-neutral, handles cannot hijack sources, and duplicate consumers fail closed", () => {
  expect(createPresenceProducer({ source: "pi", emit: () => undefined, sessionEpoch: a })).toBeUndefined();
  const first = producer("pi", () => undefined), intruder = producer("pi", () => undefined);
  expect(first.activate()).toBe(true); expect(intruder.activate()).toBe(false);
  expect(intruder.deactivate()).toBe(false); expect(first.deactivate()).toBe(true); expect(intruder.activate()).toBe(true);
  const one = consumer("pi-cmux-presence", a), two = consumer("pi-cmux-presence", b);
  expect(one.activate()).toBe(true); expect(two.activate()).toBe(false);
});

test("authoritative ingress rejects stale retention and same-generation withdrawal reopen", () => {
  const events: unknown[] = []; const source = producer("pi", (_name, event) => events.push(event));
  expect(source.activate()).toBe(true);
  expect(source.publishState(state(0, 0))).toBe(true);
  expect(source.publishState(state(0, 0))).toBe(false);
  expect(source.withdraw(withdraw(0, 1))).toBe(true);
  expect(source.publishState(state(0, 2))).toBe(false);
  expect(source.publishTerminal(terminal(0, 2, 0))).toBe(false);
  expect(source.publishState(state(1, 0))).toBe(true);
  expect(source.withdraw(withdraw(0, 9))).toBe(false);
  const late = consumer("pi-cmux-presence", a); expect(late.activate()).toBe(true);
  expect(events).toHaveLength(1);
  expect((events[0] as { generation: number }).generation).toBe(1);
});

test("reentrant deactivation does not advance consumer fences or destroy retained state on observer failure", () => {
  const target = consumer("pi-cmux-presence", a); const observed: unknown[] = [];
  expect(target.activate()).toBe(true);
  const source = producer("pi", (name, event) => { observed.push(event); target.deactivate(); throw new Error("observer failure"); });
  expect(source.activate()).toBe(true); expect(source.publishState(state())).toBe(true);
  // The original consumer never called accept, so a fresh consumer can receive the retained snapshot.
  const replacement = consumer("pi-cmux-presence", b); expect(replacement.activate()).toBe(true);
  expect(observed).toHaveLength(2);
  expect((observed[1] as { sessionEpoch: string }).sessionEpoch).toBe(b);
});

test("reentrant producer deactivate and re-register leaves source and consumer fences coherent", () => {
  const current = consumer("pi-cmux-presence", a), events: unknown[] = [];
  current.activate();
  let source: ReturnType<typeof producer>;
  source = producer("pi", (name, event) => {
    if (current.accept(name, event)) events.push(event);
    if (events.length === 1) { expect(source.deactivate()).toBe(true); expect(source.activate()).toBe(true); }
  });
  expect(source.activate()).toBe(true);
  expect(source.publishState(state(0, 0))).toBe(true);
  expect(source.publishState(state(0, 0))).toBe(true);
  expect(events).toHaveLength(2);
});

test("producer clean deactivation clears retained and all source fences for a fresh activation", () => {
  const current = consumer("pi-cmux-presence", a), events: unknown[] = [];
  current.activate();
  const emit = (name: string, event: unknown) => { if (current.accept(name, event)) events.push(event); };
  const first = producer("pi", emit); expect(first.activate()).toBe(true); expect(first.publishState(state(4, 4))).toBe(true); expect(first.deactivate()).toBe(true);
  const second = producer("pi", emit); expect(second.activate()).toBe(true);
  expect(second.publishState(state(0, 0))).toBe(true);
  expect(events).toHaveLength(2);
  expect((events[1] as { generation: number }).generation).toBe(0);
});

test("global singleton property is immutable and reset is not public", () => {
  expect("resetForTests" in api).toBe(false);
  const source = producer("pi", () => undefined); source.activate();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, Symbol.for("@pi/presence-v2/registry"));
  expect(descriptor?.configurable).toBe(false); expect(descriptor?.writable).toBe(false); expect(Object.isFrozen(descriptor?.value)).toBe(true);
});

test("an accessor-backed global registry slot fails closed without invoking its getter", async () => {
  const entry = new URL("../index.ts", import.meta.url).href;
  const script = `Object.defineProperty(globalThis, Symbol.for("@pi/presence-v2/registry"), { get() { throw new Error("getter invoked"); }, configurable: false }); const api = await import(${JSON.stringify(entry)}); if (api.createPresenceProducer({ source: "pi", emit() {} }) !== undefined) throw new Error("did not fail closed");`;
  const child = Bun.spawn({ cmd: ["bun", "-e", script], stdout: "pipe", stderr: "pipe" });
  expect(await child.exited).toBe(0);
});
