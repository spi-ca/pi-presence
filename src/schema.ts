import {
  ATTENTION_REASONS, CONSUMER_CAPABILITIES, CONSUMER_IDS, SOURCES, STATES, TERMINAL_OUTCOMES,
  type Attention, type AttentionReason, type ConsumerReadyV2, type PresenceSource, type PresenceState, type PresenceStateInputV2, type PresenceStateV2,
  type PresenceTerminalInputV2, type PresenceTerminalV2, type PresenceWithdrawInputV2, type PresenceWithdrawV2, type TerminalOutcome,
} from "./types.ts";
import { fixedStringArray, frozen, isInteger, MAX_INTEGER, ownDataRecord } from "./strict.ts";

const EPOCH_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const STATE_KEYS = ["version", "sessionEpoch", "generation", "sequence", "source", "state", "progress", "attention", "interaction", "subagents"] as const;
const STATE_INPUT_KEYS = ["version", "generation", "sequence", "source", "state", "progress", "attention", "interaction", "subagents"] as const;
const TERMINAL_KEYS = ["version", "sessionEpoch", "generation", "sequence", "source", "eventId", "outcome"] as const;
const TERMINAL_INPUT_KEYS = ["version", "generation", "sequence", "source", "eventId", "outcome"] as const;
const WITHDRAW_KEYS = ["version", "sessionEpoch", "generation", "sequence", "source"] as const;
const WITHDRAW_INPUT_KEYS = ["version", "generation", "sequence", "source"] as const;
const READY_KEYS = ["version", "sessionEpoch", "consumer"] as const;

function member<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export function isSessionEpoch(value: unknown): value is string {
  if (typeof value !== "string" || !EPOCH_PATTERN.test(value)) return false;
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    return binary.length === 24 && btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "") === value;
  } catch { return false; }
}

export function createSessionEpoch(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parseProgress(value: unknown) {
  const record = ownDataRecord(value, ["completed", "total"]);
  if (!record || !isInteger(record.completed) || !isInteger(record.total, 1) || record.completed > record.total) return undefined;
  return frozen({ completed: record.completed, total: record.total });
}
function parseAttention(value: unknown): Attention | undefined {
  const record = ownDataRecord(value, ["reason", "occurrence"]);
  if (!record || !member(ATTENTION_REASONS, record.reason) || (record.occurrence !== "new" && record.occurrence !== "retained")) return undefined;
  return frozen({ reason: record.reason as AttentionReason, occurrence: record.occurrence });
}
function parseInteraction(value: unknown) {
  const record = ownDataRecord(value, ["kind", "pending"]);
  if (!record || record.kind !== "ask_user" || !isInteger(record.pending)) return undefined;
  return frozen({ kind: "ask_user" as const, pending: record.pending });
}
function parseSubagents(value: unknown) {
  const keys = ["running", "cancelling", "queued", "completed", "failed", "cancelled", "omitted"] as const;
  const record = ownDataRecord(value, keys);
  if (!record || keys.some(key => !isInteger(record[key]))) return undefined;
  return frozen({ running: record.running as number, cancelling: record.cancelling as number, queued: record.queued as number, completed: record.completed as number, failed: record.failed as number, cancelled: record.cancelled as number, omitted: record.omitted as number });
}

function parseState(value: unknown, wire: boolean): PresenceStateInputV2 | PresenceStateV2 | undefined {
  const keys = wire ? STATE_KEYS : STATE_INPUT_KEYS;
  const required = wire ? ["version", "sessionEpoch", "generation", "sequence", "source", "state"] : ["version", "generation", "sequence", "source", "state"];
  const record = ownDataRecord(value, keys, required);
  if (!record || record.version !== 2 || (wire && !isSessionEpoch(record.sessionEpoch)) || !isInteger(record.generation) || !isInteger(record.sequence) || !member(SOURCES, record.source) || !member(STATES, record.state)) return undefined;
  const hasProgress = Object.hasOwn(record, "progress"), hasAttention = Object.hasOwn(record, "attention"), hasInteraction = Object.hasOwn(record, "interaction"), hasSubagents = Object.hasOwn(record, "subagents");
  const progress = hasProgress ? parseProgress(record.progress) : undefined;
  const attention = hasAttention ? parseAttention(record.attention) : undefined;
  const interaction = hasInteraction ? parseInteraction(record.interaction) : undefined;
  const subagents = hasSubagents ? parseSubagents(record.subagents) : undefined;
  if ((hasProgress && !progress) || (hasAttention && !attention) || (hasInteraction && !interaction) || (hasSubagents && !subagents)) return undefined;
  const source = record.source as PresenceSource, state = record.state as PresenceState;
  if (source === "interaction") {
    if (state !== "waiting" || !interaction || attention?.reason !== "input_required" || progress || subagents) return undefined;
  } else if (interaction || (attention?.reason === "input_required")) return undefined;
  if (attention?.reason === "blocked" && ((source !== "pi" && source !== "subagent") || state !== "waiting")) return undefined;
  if (attention?.reason === "failure" && ((source !== "pi" && source !== "subagent") || (state !== "error" && !(source === "subagent" && (subagents?.failed ?? 0) > 0)))) return undefined;
  if (subagents && source !== "subagent") return undefined;
  const fields = { version: 2 as const, generation: record.generation, sequence: record.sequence, source, state, ...(progress ? { progress } : {}), ...(attention ? { attention } : {}), ...(interaction ? { interaction } : {}), ...(subagents ? { subagents } : {}) };
  return wire ? frozen({ ...fields, sessionEpoch: record.sessionEpoch as string }) as PresenceStateV2 : frozen(fields) as PresenceStateInputV2;
}

function parseTerminal(value: unknown, wire: boolean): PresenceTerminalInputV2 | PresenceTerminalV2 | undefined {
  const record = ownDataRecord(value, wire ? TERMINAL_KEYS : TERMINAL_INPUT_KEYS);
  if (!record || record.version !== 2 || (wire && !isSessionEpoch(record.sessionEpoch)) || !isInteger(record.generation) || !isInteger(record.sequence) || !(record.source === "pi" || record.source === "subagent") || !isInteger(record.eventId) || !member(TERMINAL_OUTCOMES, record.outcome)) return undefined;
  const fields = { version: 2 as const, generation: record.generation, sequence: record.sequence, source: record.source as "pi" | "subagent", eventId: record.eventId, outcome: record.outcome as TerminalOutcome };
  return wire ? frozen({ ...fields, sessionEpoch: record.sessionEpoch as string }) as PresenceTerminalV2 : frozen(fields) as PresenceTerminalInputV2;
}
function parseWithdraw(value: unknown, wire: boolean): PresenceWithdrawInputV2 | PresenceWithdrawV2 | undefined {
  const record = ownDataRecord(value, wire ? WITHDRAW_KEYS : WITHDRAW_INPUT_KEYS);
  if (!record || record.version !== 2 || (wire && !isSessionEpoch(record.sessionEpoch)) || !isInteger(record.generation) || !isInteger(record.sequence) || !member(SOURCES, record.source)) return undefined;
  const fields = { version: 2 as const, generation: record.generation, sequence: record.sequence, source: record.source as PresenceSource };
  return wire ? frozen({ ...fields, sessionEpoch: record.sessionEpoch as string }) as PresenceWithdrawV2 : frozen(fields) as PresenceWithdrawInputV2;
}

export const parsePresenceStateV2 = (value: unknown) => parseState(value, true) as PresenceStateV2 | undefined;
export const parsePresenceTerminalV2 = (value: unknown) => parseTerminal(value, true) as PresenceTerminalV2 | undefined;
export const parsePresenceWithdrawV2 = (value: unknown) => parseWithdraw(value, true) as PresenceWithdrawV2 | undefined;
export const parsePresenceStateInputV2 = (value: unknown) => parseState(value, false) as PresenceStateInputV2 | undefined;
export const parsePresenceTerminalInputV2 = (value: unknown) => parseTerminal(value, false) as PresenceTerminalInputV2 | undefined;
export const parsePresenceWithdrawInputV2 = (value: unknown) => parseWithdraw(value, false) as PresenceWithdrawInputV2 | undefined;

export function parseConsumerReadyV2(value: unknown): ConsumerReadyV2 | undefined {
  const record = ownDataRecord(value, READY_KEYS);
  if (!record || record.version !== 2 || !isSessionEpoch(record.sessionEpoch)) return undefined;
  const consumer = ownDataRecord(record.consumer, ["id", "capabilities"]);
  if (!consumer || !member(CONSUMER_IDS, consumer.id) || !fixedStringArray(consumer.capabilities, CONSUMER_CAPABILITIES)) return undefined;
  return frozen({ version: 2 as const, sessionEpoch: record.sessionEpoch, consumer: frozen({ id: consumer.id, capabilities: frozen([...CONSUMER_CAPABILITIES]) as ConsumerReadyV2["consumer"]["capabilities"] }) });
}

function build<T>(parsed: T | undefined, message: string): T { if (!parsed) throw new TypeError(message); return parsed; }
export const buildPresenceStateV2 = (value: unknown) => build(parsePresenceStateV2(value), "Invalid presence state V2");
export const buildPresenceTerminalV2 = (value: unknown) => build(parsePresenceTerminalV2(value), "Invalid presence terminal V2");
export const buildPresenceWithdrawV2 = (value: unknown) => build(parsePresenceWithdrawV2(value), "Invalid presence withdrawal V2");
export const buildPresenceStateInputV2 = (value: unknown) => build(parsePresenceStateInputV2(value), "Invalid presence state input V2");
export const buildPresenceTerminalInputV2 = (value: unknown) => build(parsePresenceTerminalInputV2(value), "Invalid presence terminal input V2");
export const buildPresenceWithdrawInputV2 = (value: unknown) => build(parsePresenceWithdrawInputV2(value), "Invalid presence withdrawal input V2");
export const buildConsumerReadyV2 = (value: unknown) => build(parseConsumerReadyV2(value), "Invalid presence consumer-ready V2");
export { MAX_INTEGER };
