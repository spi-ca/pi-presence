import { expect, test } from "bun:test";
import type { PresenceStateInputV2, PresenceStateV2 } from "../index.ts";

const interactionInput: PresenceStateInputV2 = {
  version: 2, generation: 0, sequence: 0, source: "interaction", state: "waiting",
  attention: { reason: "input_required", occurrence: "new" }, interaction: { kind: "ask_user", pending: 1 },
};
const piInput: PresenceStateInputV2 = { version: 2, generation: 0, sequence: 0, source: "pi", state: "waiting", attention: { reason: "blocked", occurrence: "new" } };
const subagentInput: PresenceStateInputV2 = {
  version: 2, generation: 0, sequence: 0, source: "subagent", state: "running",
  attention: { reason: "failure", occurrence: "new" },
  subagents: { running: 0, cancelling: 0, queued: 0, completed: 0, failed: 0, cancelled: 0, omitted: 0 },
};
const interactionWire: PresenceStateV2 = { ...interactionInput, sessionEpoch: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" };

// @ts-expect-error interaction states require input-required attention.
const missingInteractionAttention: PresenceStateInputV2 = { version: 2, generation: 0, sequence: 0, source: "interaction", state: "waiting", interaction: { kind: "ask_user", pending: 1 } };
// @ts-expect-error interaction states exclude progress.
const interactionWithProgress: PresenceStateInputV2 = { ...interactionInput, progress: { completed: 1, total: 1 } };
// @ts-expect-error non-interaction sources cannot carry interaction data.
const piWithInteraction: PresenceStateInputV2 = { version: 2, generation: 0, sequence: 0, source: "pi", state: "waiting", attention: { reason: "input_required", occurrence: "new" }, interaction: { kind: "ask_user", pending: 1 } };
// @ts-expect-error exact optional fields cannot be explicitly undefined.
const piWithUndefinedProgress: PresenceStateInputV2 = { version: 2, generation: 0, sequence: 0, source: "pi", state: "running", progress: undefined };
// @ts-expect-error an interaction's required attention cannot be explicitly undefined.
const interactionWithUndefinedAttention: PresenceStateInputV2 = { version: 2, generation: 0, sequence: 0, source: "interaction", state: "waiting", attention: undefined, interaction: { kind: "ask_user", pending: 1 } };
// @ts-expect-error non-error subagent failure attention requires an exact summary.
const subagentFailureWithoutSummary: PresenceStateInputV2 = { version: 2, generation: 0, sequence: 0, source: "subagent", state: "running", attention: { reason: "failure", occurrence: "new" } };

void [missingInteractionAttention, interactionWithProgress, piWithInteraction, piWithUndefinedProgress, interactionWithUndefinedAttention, subagentFailureWithoutSummary];
test("source-aware state DTO type contracts compile", () => {
  expect([interactionInput, piInput, subagentInput, interactionWire]).toHaveLength(4);
});
