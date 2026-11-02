import type { ZodType } from 'zod';

export type SourceId = string;

export type GridSize = { w: number; h: number };

export type MetricPoint = {
  metric: string;
  ts: number;
  value: number;
  dims?: Record<string, string>;
};

export type HealthResult = { ok: boolean; detail?: string };

export interface Logger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface SourceAdapter<TConfig = unknown> {
  id: SourceId;
  displayName: string;
  configSchema: ZodType<TConfig>;
  datasets: Record<string, DatasetDef<TConfig, unknown>>;
  actions?: Record<string, ActionDef<TConfig, unknown, unknown>>;
  healthCheck?(ctx: AdapterContext<TConfig>): Promise<HealthResult>;
}

export interface DatasetDef<TConfig, TData> {
  schema: ZodType<TData>;
  refresh: { everyMs: number; staleAfterMs: number; maxBackoffMs?: number };
  fetch(ctx: AdapterContext<TConfig>): Promise<TData>;
  toMetrics?(data: TData, fetchedAt: Date): MetricPoint[];
}

export interface ActionDef<TConfig, TInput, TResult> {
  input: ZodType<TInput>;
  confirm?: boolean;
  run(ctx: AdapterContext<TConfig>, input: TInput): Promise<TResult>;
  invalidates?: string[];
}

export interface AdapterContext<TConfig> {
  config: TConfig;
  fetch: typeof fetch;
  log: Logger;
  now(): Date;
  signal: AbortSignal;
}

export interface WidgetDef<_TData = unknown> {
  id: string;
  source: SourceId;
  dataset: string;
  title: string;
  sizes: { default: GridSize; min: GridSize; max?: GridSize };
}

export type WidgetPayload<T> =
  | { state: 'ok'; data: T; fetchedAt: string; stale: boolean }
  | { state: 'error'; error: string; lastGood?: { data: T; fetchedAt: string } }
  | { state: 'disabled' };
