export const EVENT_NAMES = Object.freeze({
  state: "pi-presence:state:v2",
  terminal: "pi-presence:terminal:v2",
  withdraw: "pi-presence:withdraw:v2",
  consumerReady: "pi-presence:consumer-ready:v2",
});

export const CONSUMER_CAPABILITIES = Object.freeze([
  "presence-state-v2",
  "presence-terminal-v2",
  "presence-withdraw-v2",
] as const);
export const CONSUMER_IDS = Object.freeze(["pi-cmux-presence", "pi-herdr-presence"] as const);
export const SOURCES = Object.freeze(["pi", "todo", "subagent", "interaction"] as const);
export const STATES = Object.freeze(["idle", "waiting", "running", "success", "error", "cancelled"] as const);
export const ATTENTION_REASONS = Object.freeze(["input_required", "blocked", "failure"] as const);
export const TERMINAL_OUTCOMES = Object.freeze(["completed", "failed", "cancelled"] as const);

export type PresenceSource = (typeof SOURCES)[number];
export type PresenceState = (typeof STATES)[number];
export type AttentionReason = (typeof ATTENTION_REASONS)[number];
export type TerminalOutcome = (typeof TERMINAL_OUTCOMES)[number];
export type ConsumerId = (typeof CONSUMER_IDS)[number];
export type PresenceCapability = (typeof CONSUMER_CAPABILITIES)[number];

export type Progress = Readonly<{ completed: number; total: number }>;
export type Attention = Readonly<{ reason: AttentionReason; occurrence: "new" | "retained" }>;
export type Interaction = Readonly<{ kind: "ask_user"; pending: number }>;
export type Subagents = Readonly<{ running: number; cancelling: number; queued: number; completed: number; failed: number; cancelled: number; omitted: number }>;

type StateBase<S extends PresenceSource, T extends PresenceState> = Readonly<{
  version: 2;
  generation: number;
  sequence: number;
  source: S;
  state: T;
  progress?: Progress;
}>;
type BlockedAttention = Readonly<{ reason: "blocked"; occurrence: "new" | "retained" }>;
type FailureAttention = Readonly<{ reason: "failure"; occurrence: "new" | "retained" }>;
type InputRequiredAttention = Readonly<{ reason: "input_required"; occurrence: "new" | "retained" }>;
type PiWaitingState = StateBase<"pi", "waiting"> & Readonly<{ attention?: BlockedAttention; interaction?: never; subagents?: never }>;
type PiErrorState = StateBase<"pi", "error"> & Readonly<{ attention?: FailureAttention; interaction?: never; subagents?: never }>;
type PiOrdinaryState = StateBase<"pi", Exclude<PresenceState, "waiting" | "error">> & Readonly<{ attention?: never; interaction?: never; subagents?: never }>;
type TodoState = StateBase<"todo", PresenceState> & Readonly<{ attention?: never; interaction?: never; subagents?: never }>;
type SubagentOrdinaryState = StateBase<"subagent", PresenceState> & Readonly<{ attention?: never; interaction?: never; subagents?: Subagents }>;
type SubagentBlockedState = StateBase<"subagent", "waiting"> & Readonly<{ attention: BlockedAttention; interaction?: never; subagents?: Subagents }>;
type SubagentErrorState = StateBase<"subagent", "error"> & Readonly<{ attention: FailureAttention; interaction?: never; subagents?: Subagents }>;
type SubagentSummaryFailureState = StateBase<"subagent", PresenceState> & Readonly<{ attention: FailureAttention; interaction?: never; subagents: Subagents }>;
type InteractionState = Readonly<{
  version: 2;
  generation: number;
  sequence: number;
  source: "interaction";
  state: "waiting";
  attention: InputRequiredAttention;
  interaction: Interaction;
  progress?: never;
  subagents?: never;
}>;
type StateFields = PiWaitingState | PiErrorState | PiOrdinaryState | TodoState | SubagentOrdinaryState | SubagentBlockedState | SubagentErrorState | SubagentSummaryFailureState | InteractionState;
type TerminalFields = Readonly<{ version: 2; generation: number; sequence: number; source: "pi" | "subagent"; eventId: number; outcome: TerminalOutcome }>;
type WithdrawFields = Readonly<{ version: 2; generation: number; sequence: number; source: PresenceSource }>;
type WithSessionEpoch<T> = T extends unknown ? Readonly<T & { sessionEpoch: string }> : never;

/** Producer-facing DTOs deliberately contain no session epoch. State inputs are source-aware unions. */
export type PresenceStateInputV2 = StateFields;
export type PresenceTerminalInputV2 = TerminalFields;
export type PresenceWithdrawInputV2 = WithdrawFields;

/** Wire DTOs are tagged by the registry for one consumer epoch. State wires are source-aware unions. */
export type PresenceStateV2 = WithSessionEpoch<StateFields>;
export type PresenceTerminalV2 = Readonly<TerminalFields & { sessionEpoch: string }>;
export type PresenceWithdrawV2 = Readonly<WithdrawFields & { sessionEpoch: string }>;

export type ConsumerReadyV2 = Readonly<{
  version: 2;
  sessionEpoch: string;
  consumer: Readonly<{ id: ConsumerId; capabilities: readonly ["presence-state-v2", "presence-terminal-v2", "presence-withdraw-v2"] }>;
}>;

export type PresenceEventV2 = PresenceStateV2 | PresenceTerminalV2 | PresenceWithdrawV2;
export type ProducerSnapshotV2 = PresenceStateInputV2 | PresenceTerminalInputV2 | PresenceWithdrawInputV2;
export type TerminalTuple = Readonly<{ source: "pi" | "subagent"; generation: number; eventId: number; outcome: TerminalOutcome }>;
export type TerminalBatch = Readonly<{ value: string; overflow: number; records: readonly TerminalTuple[] }>;
export type ProducerEmit = (eventName: string, event: PresenceEventV2) => void;
export type ConsumerReadyEmit = (eventName: string, event: ConsumerReadyV2) => void;

export type PresenceProducerHandle = Readonly<{
  activate: () => boolean;
  publishState: (snapshot: unknown) => boolean;
  publishTerminal: (snapshot: unknown) => boolean;
  withdraw: (snapshot: unknown) => boolean;
  deactivate: () => boolean;
}>;
export type PresenceConsumerHandle = Readonly<{
  ready: ConsumerReadyV2;
  activate: (emitReady?: ConsumerReadyEmit) => boolean;
  accept: (eventName: unknown, payload: unknown) => PresenceEventV2 | undefined;
  deactivate: () => boolean;
}>;
