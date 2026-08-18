import { types } from "node:util";

export const MAX_INTEGER = 1_000_000;

export function isInteger(value: unknown, minimum = 0): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= MAX_INTEGER;
}

/** Checks an untrusted object without invoking a user getter or proxy trap. */
export function ownDataRecord(value: unknown, keys: readonly string[], required: readonly string[] = keys): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || types.isProxy(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some(key => typeof key !== "string" || !keys.includes(key))) return undefined;
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of ownKeys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return undefined;
    result[key] = descriptor.value;
  }
  for (const key of required) if (!(key in result)) return undefined;
  return result;
}

/** Fixed-size dense primitive arrays only. Proxy detection deliberately precedes Array.isArray. */
export function denseArray(value: unknown, maximum: number): readonly unknown[] | undefined {
  if (value === null || typeof value !== "object" || types.isProxy(value)) return undefined;
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) return undefined;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== value.length + 1 || !ownKeys.includes("length")) return undefined;
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return undefined;
    result.push(descriptor.value);
  }
  return result;
}

export function fixedStringArray(value: unknown, expected: readonly string[]): boolean {
  if (value === null || typeof value !== "object" || types.isProxy(value)) return false;
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== expected.length) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== expected.length + 1 || !ownKeys.includes("length")) return false;
  for (let index = 0; index < expected.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || descriptor.value !== expected[index]) return false;
  }
  return true;
}

export function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}
