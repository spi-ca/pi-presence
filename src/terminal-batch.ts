import { parsePresenceTerminalV2 } from "./schema.ts";
import { denseArray, frozen, frozenRecord, isInteger } from "./strict.ts";
import type { TerminalBatch, TerminalOutcome, TerminalTuple } from "./types.ts";

const RECORD_PATTERN = /^(pi|subagent):(0|[1-9][0-9]{0,6}):(0|[1-9][0-9]{0,6}):(completed|failed|cancelled)$/;
const DECIMAL_PATTERN = /^(0|[1-9][0-9]{0,6})$/;
const MAX_TERMINAL_BATCH_BYTES = 128;
const order = (left: TerminalTuple, right: TerminalTuple) =>
  left.source.localeCompare(right.source) || left.generation - right.generation || left.eventId - right.eventId || left.outcome.localeCompare(right.outcome);

function validOverflow(value: unknown): value is number {
  return typeof value === "number" && isInteger(value) && DECIMAL_PATTERN.test(String(value));
}

function ownTuple(value: unknown): TerminalTuple | undefined {
  const terminal = parsePresenceTerminalV2(value);
  if (!terminal) return undefined;
  return frozenRecord({ source: terminal.source, generation: terminal.generation, eventId: terminal.eventId, outcome: terminal.outcome });
}

function format(records: readonly TerminalTuple[]): string {
  return records.map(record => `${record.source}:${record.generation}:${record.eventId}:${record.outcome}`).join(",");
}

function exceedsTerminalBatchByteLimit(value: string): boolean {
  return value.length > MAX_TERMINAL_BATCH_BYTES || new TextEncoder().encode(value).byteLength > MAX_TERMINAL_BATCH_BYTES;
}

export function encodeTerminalBatch(values: readonly unknown[], overflow = 0): TerminalBatch {
  const input = denseArray(values, 3);
  if (!input || !validOverflow(overflow)) throw new TypeError("Invalid terminal batch");
  const parsed = input.map(ownTuple);
  if (parsed.some((record): record is undefined => !record)) throw new TypeError("Invalid terminal tuple");
  const records = parsed as TerminalTuple[];
  const sorted = [...records].sort(order);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous.source === current.source && previous.generation === current.generation && previous.eventId === current.eventId) throw new TypeError("Duplicate or conflicting terminal tuple");
  }
  const value = format(sorted);
  if (exceedsTerminalBatchByteLimit(value)) throw new TypeError("Terminal batch exceeds 128 bytes");
  return frozenRecord({ value, overflow, records: frozen(sorted) });
}

export function parseTerminalBatch(value: unknown, overflow: unknown = 0): TerminalBatch | undefined {
  if (typeof value !== "string" || !validOverflow(overflow) || exceedsTerminalBatchByteLimit(value)) return undefined;
  if (value === "") return frozenRecord({ value: "", overflow, records: frozen([]) });
  const parts = value.split(",");
  if (parts.length > 3 || parts.some(part => !RECORD_PATTERN.test(part))) return undefined;
  const records: TerminalTuple[] = [];
  for (const part of parts) {
    const match = RECORD_PATTERN.exec(part);
    if (!match) return undefined;
    const tuple = frozenRecord({ source: match[1] as "pi" | "subagent", generation: Number(match[2]), eventId: Number(match[3]), outcome: match[4] as TerminalOutcome });
    if (!isInteger(tuple.generation) || !isInteger(tuple.eventId)) return undefined;
    records.push(tuple);
  }
  try {
    const canonical = encodeTerminalBatch(records.map(record => ({ version: 2, sessionEpoch: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", sequence: 0, ...record })), overflow);
    return canonical.value === value ? canonical : undefined;
  } catch {
    return undefined;
  }
}
