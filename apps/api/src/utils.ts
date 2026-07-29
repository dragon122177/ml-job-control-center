import { randomUUID } from "node:crypto";

export function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export function camelize<T = Record<string, unknown>>(row: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      value
    ])
  ) as T;
}

export function camelizeRows<T = Record<string, unknown>>(
  rows: Record<string, unknown>[]
): T[] {
  return rows.map((row) => camelize<T>(row));
}

export function safeJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "object" && value !== null) return value as T;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
