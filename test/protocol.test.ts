import { describe, expect, test } from "bun:test";
import fixture from "../fixtures/normative.json";
import {
  CONSUMER_CAPABILITIES, EVENT_NAMES, MAX_INTEGER, buildPresenceStateV2, createSessionEpoch, isSessionEpoch,
  encodeTerminalBatch, parseConsumerReadyV2, parsePresenceStateInputV2, parsePresenceStateV2, parsePresenceTerminalInputV2, parsePresenceTerminalV2, parsePresenceWithdrawInputV2, parsePresenceWithdrawV2, parseTerminalBatch, type TerminalBatch,
} from "../index.ts";

const epoch = fixture.sessionEpoch;
const base = (): Record<string, unknown> => ({ version: 2, sessionEpoch: epoch, generation: 1, sequence: 1, source: "pi", state: "running" });
const terminalBatch = fixture.terminalBatch as TerminalBatch;

describe("normative protocol", () => {
  test("has fixed channels, capabilities, and valid fixture sections", () => {
    expect(Object.values(EVENT_NAMES)).toEqual(["pi-presence:state:v2", "pi-presence:terminal:v2", "pi-presence:withdraw:v2", "pi-presence:consumer-ready:v2"]);
    expect(CONSUMER_CAPABILITIES).toEqual(["presence-state-v2", "presence-terminal-v2", "presence-withdraw-v2"]);
    expect(isSessionEpoch(fixture.sessionEpoch)).toBe(true);
    for (const state of fixture.states) expect(parsePresenceStateV2(state)).toBeDefined();
    for (const terminal of fixture.terminals) expect(parsePresenceTerminalV2(terminal)).toBeDefined();
    expect(parsePresenceWithdrawV2(fixture.withdraw)).toBeDefined();
    expect(parseConsumerReadyV2(fixture.consumerReady)).toBeDefined();
    expect(parseTerminalBatch(terminalBatch.value, terminalBatch.overflow)).toEqual(terminalBatch);
    expect(encodeTerminalBatch(fixture.terminals, terminalBatch.overflow)).toEqual(terminalBatch);
  });
  test("generates canonical 24-byte base64url epochs", () => {
    const generated = createSessionEpoch();
    expect(generated).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(createSessionEpoch()).not.toBe(generated);
  });
  test("rejects bounds, unknown keys, inheritance, accessors, symbols, and malformed epochs", () => {
    expect(parsePresenceStateV2({ ...base(), generation: -1 })).toBeUndefined();
    expect(parsePresenceStateV2({ ...base(), generation: 0, sequence: 0 })).toBeDefined();
    expect(parsePresenceStateV2({ ...base(), sequence: MAX_INTEGER + 1 })).toBeUndefined();
    expect(parsePresenceStateV2({ ...base(), extra: 1 })).toBeUndefined();
    expect(parsePresenceStateV2(Object.create(base()))).toBeUndefined();
    const accessor = base(); Object.defineProperty(accessor, "state", { enumerable: true, get: () => "running" });
    expect(parsePresenceStateV2(accessor)).toBeUndefined();
    const symbol = base(); Object.defineProperty(symbol, Symbol("x"), { enumerable: true, value: 1 });
    expect(parsePresenceStateV2(symbol)).toBeUndefined();
    expect(parsePresenceStateV2({ ...base(), sessionEpoch: "A".repeat(31) })).toBeUndefined();
    expect(parsePresenceStateV2({ ...base(), sessionEpoch: "!".repeat(32) })).toBeUndefined();
    expect(parsePresenceStateV2({ ...base(), progress: undefined })).toBeUndefined();
  });
  test("producer input DTOs exclude epochs and retain zero protocol values", () => {
    const input = { version: 2, generation: 0, sequence: 0, source: "pi", state: "running" };
    expect(parsePresenceStateInputV2(input)).toBeDefined();
    expect(parsePresenceStateInputV2({ ...input, sessionEpoch: epoch })).toBeUndefined();
    expect(parsePresenceTerminalInputV2({ version: 2, generation: 0, sequence: 0, source: "pi", eventId: 0, outcome: "completed" })).toBeDefined();
    expect(parsePresenceWithdrawInputV2({ version: 2, generation: 0, sequence: 0, source: "pi" })).toBeDefined();
  });
  test("enforces source-aware semantic combinations", () => {
    const interactionInput = { version: 2, generation: 0, sequence: 0, source: "interaction", state: "waiting", interaction: { kind: "ask_user", pending: 1 }, attention: { reason: "input_required", occurrence: "new" } };
    expect(parsePresenceStateV2({ ...base(), source: "interaction", state: "waiting", interaction: { kind: "ask_user", pending: 1 }, attention: { reason: "input_required", occurrence: "new" } })).toBeDefined();
    expect(parsePresenceStateInputV2(interactionInput)).toBeDefined();
    expect(parsePresenceStateInputV2({ ...interactionInput, attention: undefined })).toBeUndefined();
    expect(parsePresenceStateInputV2({ ...interactionInput, progress: { completed: 1, total: 1 } })).toBeUndefined();
    expect(parsePresenceStateInputV2({ ...interactionInput, subagents: { running: 0, cancelling: 0, queued: 0, completed: 0, failed: 0, cancelled: 0, omitted: 0 } })).toBeUndefined();
    expect(parsePresenceStateV2({ ...base(), attention: { reason: "input_required", occurrence: "new" } })).toBeUndefined();
    expect(parsePresenceStateV2({ ...base(), attention: { reason: "blocked", occurrence: "new" } })).toBeUndefined();
    expect(parsePresenceStateV2({ ...base(), state: "waiting", attention: { reason: "blocked", occurrence: "new" } })).toBeDefined();
    expect(parsePresenceStateV2({ ...base(), attention: { reason: "failure", occurrence: "new" } })).toBeUndefined();
    const zeroFailureSummary = { running: 0, cancelling: 0, queued: 0, completed: 0, failed: 0, cancelled: 0, omitted: 0 };
    expect(parsePresenceStateInputV2({ version: 2, generation: 0, sequence: 0, source: "subagent", state: "running", attention: { reason: "failure", occurrence: "new" }, subagents: zeroFailureSummary })).toBeDefined();
    expect(parsePresenceStateInputV2({ version: 2, generation: 0, sequence: 0, source: "subagent", state: "running", attention: { reason: "failure", occurrence: "new" } })).toBeUndefined();
    expect(parsePresenceStateV2({ ...base(), source: "todo", progress: { completed: 2, total: 1 } })).toBeUndefined();
    expect(parsePresenceStateV2({ ...base(), source: "todo", progress: { completed: 0, total: 0 } })).toBeUndefined();
    expect(parsePresenceStateInputV2({ version: 2, generation: 0, sequence: 0, source: "todo", state: "running", progress: { completed: 0, total: 0 } })).toBeUndefined();
    expect(parsePresenceStateV2({ ...base(), subagents: { running: 0, cancelling: 0, queued: 0, completed: 0, failed: 0, cancelled: 0, omitted: 0 } })).toBeUndefined();
  });
  test("copies and freezes all accepted data", () => {
    const raw = { ...base(), progress: { completed: 1, total: 2 } };
    const parsed = buildPresenceStateV2(raw);
    raw.progress.completed = 2;
    expect(parsed.progress?.completed).toBe(1);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.progress!)).toBe(true);
    expect(Object.getPrototypeOf(parsed)).toBeNull();
    expect(Object.getPrototypeOf(parsed.progress!)).toBeNull();
    expect(() => { (parsed.progress as { completed: number }).completed = 9; }).toThrow();
  });
  test("returns null-prototype records for every public parsed DTO shape", () => {
    const interaction = parsePresenceStateV2({ ...base(), source: "interaction", state: "waiting", attention: { reason: "input_required", occurrence: "new" }, interaction: { kind: "ask_user", pending: 1 } })!;
    const subagent = parsePresenceStateV2({ ...base(), source: "subagent", attention: { reason: "failure", occurrence: "new" }, subagents: { running: 0, cancelling: 0, queued: 0, completed: 0, failed: 0, cancelled: 0, omitted: 0 } })!;
    const terminal = parsePresenceTerminalV2({ version: 2, sessionEpoch: epoch, generation: 0, sequence: 0, source: "pi", eventId: 0, outcome: "completed" })!;
    const withdrawal = parsePresenceWithdrawV2({ version: 2, sessionEpoch: epoch, generation: 0, sequence: 0, source: "pi" })!;
    const ready = parseConsumerReadyV2(fixture.consumerReady)!;
    const records: object[] = [interaction, interaction.attention!, interaction.interaction!, subagent, subagent.attention!, subagent.subagents!, terminal, withdrawal, ready, ready.consumer];
    for (const record of records) {
      expect(Object.getPrototypeOf(record)).toBeNull();
      expect(Object.isFrozen(record)).toBe(true);
    }
  });
  test("rejects privacy-bearing fields rather than projecting them", () => {
    expect(parsePresenceStateV2({ ...base(), prompt: "credential=do-not-leak", path: "/private", error: "raw output" })).toBeUndefined();
  });
  test("detects every proxy before it can trigger a trap", () => {
    let traps = 0;
    const hostile = new Proxy({}, { get: () => { traps += 1; return undefined; }, ownKeys: () => { traps += 1; return []; }, getOwnPropertyDescriptor: () => { traps += 1; return undefined; } });
    expect(parsePresenceStateV2(hostile)).toBeUndefined();
    expect(parsePresenceTerminalV2(hostile)).toBeUndefined();
    expect(parsePresenceWithdrawV2(hostile)).toBeUndefined();
    expect(parseConsumerReadyV2(hostile)).toBeUndefined();
    expect(traps).toBe(0);
  });
  test("rejects proxied nested records and non-dense capability arrays", () => {
    let traps = 0;
    const nested = new Proxy({}, { ownKeys: () => { traps += 1; return []; } });
    expect(parsePresenceStateV2({ ...base(), progress: nested })).toBeUndefined();
    const ready = { ...fixture.consumerReady, consumer: { ...fixture.consumerReady.consumer, capabilities: ["presence-state-v2", , "presence-withdraw-v2"] } };
    expect(parseConsumerReadyV2(ready)).toBeUndefined();
    expect(traps).toBe(0);
  });
});
