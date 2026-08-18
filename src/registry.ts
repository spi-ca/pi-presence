import { types } from "node:util";
import { EVENT_NAMES, CONSUMER_CAPABILITIES, CONSUMER_IDS, SOURCES, type ConsumerId, type ConsumerReadyEmit, type ConsumerReadyV2, type PresenceConsumerHandle, type PresenceEventV2, type PresenceProducerHandle, type PresenceSource, type PresenceStateInputV2, type PresenceStateV2, type PresenceTerminalInputV2, type PresenceTerminalV2, type PresenceWithdrawInputV2, type PresenceWithdrawV2, type ProducerEmit } from "./types.ts";
import { createSessionEpoch, isSessionEpoch, parsePresenceStateInputV2, parsePresenceStateV2, parsePresenceTerminalInputV2, parsePresenceTerminalV2, parsePresenceWithdrawInputV2, parsePresenceWithdrawV2 } from "./schema.ts";
import { frozen, ownDataRecord } from "./strict.ts";

const REGISTRY_SYMBOL = Symbol.for("@pi/presence-v2/registry");
const ABI = "@pi/presence-v2:0.1.0:opaque-handles:3";
const INTERFACE = "createPresenceProducer/createPresenceConsumer";

type Fence = { generation: number; sequence: number; withdrawnGeneration: number; withdrawnSequence: number; terminalGeneration: number; terminalHighWater: number };
type Producer = { source: PresenceSource; emit: ProducerEmit; activeVersion: number };
type Consumer = { id: ConsumerId; epoch: string; ready: ConsumerReadyV2; fences: Map<PresenceSource, Fence> };
type DeliveryReceipt = { consumer: Consumer; producer: Producer; source: PresenceSource; activeVersion: number; eventName: string };
type PrivateRegistry = { consumers: Map<ConsumerId, Consumer>; producers: Map<PresenceSource, Producer>; retained: Map<PresenceSource, PresenceStateInputV2>; ingress: Map<PresenceSource, Fence> };
type GlobalRegistry = Readonly<{ abi: string; interface: string; createProducer: (value: unknown) => PresenceProducerHandle | undefined; createConsumer: (value: unknown) => PresenceConsumerHandle | undefined }>;

const freshFence = (): Fence => ({ generation: -1, sequence: -1, withdrawnGeneration: -1, withdrawnSequence: -1, terminalGeneration: -1, terminalHighWater: -1 });
function fenceFor(fences: Map<PresenceSource, Fence>, source: PresenceSource): Fence { let fence = fences.get(source); if (!fence) { fence = freshFence(); fences.set(source, fence); } return fence; }

/** Shared ingress/consumer ordering rule.  -1 is an internal-only empty-fence sentinel. */
function acceptFence(fences: Map<PresenceSource, Fence>, event: PresenceStateInputV2 | PresenceTerminalInputV2 | PresenceWithdrawInputV2): boolean {
  const fence = fenceFor(fences, event.source);
  if ("state" in event || "eventId" in event) {
    if (event.generation <= fence.withdrawnGeneration || event.generation < fence.generation || (event.generation === fence.generation && event.sequence <= fence.sequence)) return false;
    if ("eventId" in event) {
      if (event.generation > fence.generation) { fence.terminalGeneration = event.generation; fence.terminalHighWater = -1; }
      if (event.generation !== fence.terminalGeneration || event.eventId <= fence.terminalHighWater) return false;
      fence.terminalHighWater = event.eventId;
    } else if (event.generation > fence.generation) { fence.terminalGeneration = event.generation; fence.terminalHighWater = -1; }
    fence.generation = event.generation;
    fence.sequence = event.sequence;
    return true;
  }
  if (event.generation < fence.generation || (event.generation === fence.generation && event.sequence <= fence.sequence) || event.generation < fence.withdrawnGeneration || (event.generation === fence.withdrawnGeneration && event.sequence <= fence.withdrawnSequence)) return false;
  fence.generation = event.generation;
  fence.sequence = event.sequence;
  fence.withdrawnGeneration = event.generation;
  fence.withdrawnSequence = event.sequence;
  return true;
}

function tagState(event: PresenceStateInputV2, epoch: string, retained: boolean): PresenceStateV2 {
  return frozen({ ...event, sessionEpoch: epoch, ...(event.attention ? { attention: frozen({ ...event.attention, occurrence: retained ? "retained" as const : event.attention.occurrence }) } : {}) });
}
function tagEvent(event: PresenceTerminalInputV2 | PresenceWithdrawInputV2, epoch: string): PresenceTerminalV2 | PresenceWithdrawV2 { return frozen({ ...event, sessionEpoch: epoch }); }
function eventName(event: PresenceEventV2): string { return "eventId" in event ? EVENT_NAMES.terminal : "state" in event ? EVENT_NAMES.state : EVENT_NAMES.withdraw; }
function freezeMethod<T extends Function>(method: T): T { return Object.freeze(method); }

function createGlobalRegistry(): GlobalRegistry {
  const state: PrivateRegistry = { consumers: new Map(), producers: new Map(), retained: new Map(), ingress: new Map() };
  const receipts = new WeakMap<object, DeliveryReceipt>();

  function deliver(producer: Producer, version: number, consumer: Consumer, event: PresenceStateInputV2 | PresenceTerminalInputV2 | PresenceWithdrawInputV2, retained = false): void {
    if (state.producers.get(producer.source) !== producer || producer.activeVersion !== version || state.consumers.get(consumer.id) !== consumer) return;
    const tagged = "state" in event ? tagState(event, consumer.epoch, retained) : tagEvent(event, consumer.epoch);
    const name = eventName(tagged);
    receipts.set(tagged, { consumer, producer, source: producer.source, activeVersion: version, eventName: name });
    try { producer.emit(name, tagged); } catch { /* delivery is best effort; retention is already coherent */ } finally { receipts.delete(tagged); }
  }
  function replay(producer: Producer, version: number, consumer: Consumer): void {
    const snapshot = state.retained.get(producer.source);
    if (snapshot) deliver(producer, version, consumer, snapshot, true);
  }
  function dispatch(producer: Producer, event: PresenceStateInputV2 | PresenceTerminalInputV2 | PresenceWithdrawInputV2): boolean {
    const version = producer.activeVersion;
    if (state.producers.get(producer.source) !== producer || event.source !== producer.source || !acceptFence(state.ingress, event)) return false;
    if ("state" in event) state.retained.set(event.source, event);
    else if (!("eventId" in event)) state.retained.delete(event.source);
    for (const consumer of [...state.consumers.values()]) {
      if (state.producers.get(producer.source) !== producer || producer.activeVersion !== version) break;
      deliver(producer, version, consumer, event);
    }
    return true;
  }
  function createProducer(value: unknown): PresenceProducerHandle | undefined {
    const input = ownDataRecord(value, ["source", "emit"]);
    if (!input || typeof input.source !== "string" || !(SOURCES as readonly string[]).includes(input.source) || typeof input.emit !== "function") return undefined;
    const producer: Producer = { source: input.source as PresenceSource, emit: input.emit as ProducerEmit, activeVersion: 0 };
    const activate = freezeMethod(() => {
      if (state.producers.get(producer.source)) return false;
      const version = producer.activeVersion + 1;
      producer.activeVersion = version;
      state.producers.set(producer.source, producer);
      for (const consumer of [...state.consumers.values()]) {
        if (state.producers.get(producer.source) !== producer || producer.activeVersion !== version) break;
        replay(producer, version, consumer);
      }
      return state.producers.get(producer.source) === producer && producer.activeVersion === version;
    });
    const publishState = freezeMethod((snapshot: unknown) => { const event = parsePresenceStateInputV2(snapshot); return !!event && dispatch(producer, event); });
    const publishTerminal = freezeMethod((snapshot: unknown) => { const event = parsePresenceTerminalInputV2(snapshot); return !!event && dispatch(producer, event); });
    const withdraw = freezeMethod((snapshot: unknown) => { const event = parsePresenceWithdrawInputV2(snapshot); return !!event && dispatch(producer, event); });
    const deactivate = freezeMethod(() => {
      if (state.producers.get(producer.source) !== producer) return false;
      state.producers.delete(producer.source);
      state.retained.delete(producer.source);
      state.ingress.delete(producer.source);
      for (const consumer of state.consumers.values()) consumer.fences.delete(producer.source);
      return true;
    });
    return frozen({ activate, publishState, publishTerminal, withdraw, deactivate });
  }
  function createConsumer(value: unknown): PresenceConsumerHandle | undefined {
    const input = ownDataRecord(value, ["id", "sessionEpoch"], ["id"]);
    if (!input || typeof input.id !== "string" || !(CONSUMER_IDS as readonly string[]).includes(input.id) || (Object.hasOwn(input, "sessionEpoch") && !isSessionEpoch(input.sessionEpoch))) return undefined;
    const id = input.id as ConsumerId;
    const epoch = (input.sessionEpoch as string | undefined) ?? createSessionEpoch();
    const ready = frozen({ version: 2 as const, sessionEpoch: epoch, consumer: frozen({ id, capabilities: frozen([...CONSUMER_CAPABILITIES]) as ConsumerReadyV2["consumer"]["capabilities"] }) });
    const consumer: Consumer = { id, epoch, ready, fences: new Map() };
    const activate = freezeMethod((emitReady?: ConsumerReadyEmit) => {
      if (emitReady !== undefined && typeof emitReady !== "function") return false;
      if (state.consumers.has(id)) return false;
      state.consumers.set(id, consumer);
      if (emitReady) { try { emitReady(EVENT_NAMES.consumerReady, ready); } catch { /* ready is synchronous best effort */ } }
      for (const producer of [...state.producers.values()]) replay(producer, producer.activeVersion, consumer);
      return state.consumers.get(id) === consumer;
    });
    const accept = freezeMethod((name: unknown, payload: unknown): PresenceEventV2 | undefined => {
      if (payload === null || typeof payload !== "object") return undefined;
      // Identity lookup is deliberately the only payload operation before receipt consumption.
      const receipt = receipts.get(payload);
      if (!receipt || typeof name !== "string" || receipt.consumer !== consumer || receipt.eventName !== name || receipt.source !== receipt.producer.source || receipt.activeVersion !== receipt.producer.activeVersion || state.consumers.get(id) !== consumer || state.producers.get(receipt.source) !== receipt.producer) return undefined;
      receipts.delete(payload);
      const event = name === EVENT_NAMES.state ? parsePresenceStateV2(payload) : name === EVENT_NAMES.terminal ? parsePresenceTerminalV2(payload) : name === EVENT_NAMES.withdraw ? parsePresenceWithdrawV2(payload) : undefined;
      if (!event || event.sessionEpoch !== epoch || event.source !== receipt.source || eventName(event) !== name) return undefined;
      const neutral = "state" in event ? (() => { const { sessionEpoch: _epoch, ...value } = event; return value; })() : (() => { const { sessionEpoch: _epoch, ...value } = event; return value; })();
      return acceptFence(consumer.fences, neutral) ? event : undefined;
    });
    const deactivate = freezeMethod(() => state.consumers.get(id) === consumer ? (state.consumers.delete(id), true) : false);
    return frozen({ ready, activate, accept, deactivate });
  }
  return frozen({ abi: ABI, interface: INTERFACE, createProducer: freezeMethod(createProducer), createConsumer: freezeMethod(createConsumer) });
}

function validGlobalRegistry(value: unknown): value is GlobalRegistry {
  if (value === null || typeof value !== "object" || types.isProxy(value) || !Object.isFrozen(value)) return false;
  const record = ownDataRecord(value, ["abi", "interface", "createProducer", "createConsumer"]);
  return !!record && record.abi === ABI && record.interface === INTERFACE && typeof record.createProducer === "function" && typeof record.createConsumer === "function";
}
function globalRegistry(): GlobalRegistry | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, REGISTRY_SYMBOL);
  if (descriptor) return "value" in descriptor && descriptor.writable === false && descriptor.configurable === false && validGlobalRegistry(descriptor.value) ? descriptor.value : undefined;
  const created = createGlobalRegistry();
  try { Object.defineProperty(globalThis, REGISTRY_SYMBOL, { value: created, writable: false, configurable: false, enumerable: false }); } catch { return undefined; }
  return created;
}

/** Creates a source-owned producer. Session epochs are registry-owned and never accepted here. */
export function createPresenceProducer(value: unknown): PresenceProducerHandle | undefined { return globalRegistry()?.createProducer(value); }
/** Creates a consumer handle. Epochs route/freshen events; they are not credentials. */
export function createPresenceConsumer(value: unknown): PresenceConsumerHandle | undefined { return globalRegistry()?.createConsumer(value); }
