import { describe, expectTypeOf, it } from 'vitest';
import type { ZodType } from 'zod';
import { z } from 'zod';
import type {
  ActionDef,
  AdapterContext,
  DatasetDef,
  GridSize,
  HealthResult,
  Logger,
  MetricPoint,
  SourceAdapter,
  SourceId,
  WidgetDef,
  WidgetPayload,
} from './contracts.js';

describe('contract types', () => {
  it('matches the plugin seam shapes', () => {
    expectTypeOf<SourceId>().toEqualTypeOf<string>();

    expectTypeOf<GridSize>().toEqualTypeOf<{ w: number; h: number }>();

    expectTypeOf<MetricPoint>().toEqualTypeOf<{
      metric: string;
      ts: number;
      value: number;
      dims?: Record<string, string>;
    }>();

    expectTypeOf<HealthResult>().toEqualTypeOf<{
      ok: boolean;
      detail?: string;
    }>();

    expectTypeOf<Logger>().toEqualTypeOf<{
      info: (obj: object, msg?: string) => void;
      warn: (obj: object, msg?: string) => void;
      error: (obj: object, msg?: string) => void;
    }>();

    type DemoConfig = { region: string };
    type DemoData = { value: number };

    expectTypeOf<SourceAdapter<DemoConfig>>().toMatchTypeOf<{
      id: SourceId;
      displayName: string;
      configSchema: ZodType<DemoConfig>;
      datasets: Record<string, DatasetDef<DemoConfig, unknown>>;
      actions?: Record<string, ActionDef<DemoConfig, unknown, unknown>>;
      healthCheck?: (ctx: AdapterContext<DemoConfig>) => Promise<HealthResult>;
    }>();

    expectTypeOf<DatasetDef<DemoConfig, DemoData>>().toMatchTypeOf<{
      schema: ZodType<DemoData>;
      refresh: {
        everyMs: number;
        staleAfterMs: number;
        maxBackoffMs?: number;
      };
      fetch: (ctx: AdapterContext<DemoConfig>) => Promise<DemoData>;
      toMetrics?: (data: DemoData, fetchedAt: Date) => MetricPoint[];
    }>();

    expectTypeOf<
      ActionDef<DemoConfig, { note: string }, { ok: boolean }>
    >().toMatchTypeOf<{
      input: ZodType<{ note: string }>;
      confirm?: boolean;
      run: (
        ctx: AdapterContext<DemoConfig>,
        input: { note: string },
      ) => Promise<{ ok: boolean }>;
      invalidates?: string[];
    }>();

    expectTypeOf<AdapterContext<DemoConfig>>().toEqualTypeOf<{
      config: DemoConfig;
      fetch: typeof fetch;
      log: Logger;
      now: () => Date;
      signal: AbortSignal;
    }>();

    expectTypeOf<WidgetDef<DemoData>>().toMatchTypeOf<{
      id: string;
      source: SourceId;
      dataset: string;
      title: string;
      sizes: { default: GridSize; min: GridSize; max?: GridSize };
    }>();

    expectTypeOf<WidgetPayload<DemoData>>().toMatchTypeOf<
      | { state: 'ok'; data: DemoData; fetchedAt: string; stale: boolean }
      | {
          state: 'error';
          error: string;
          lastGood?: { data: DemoData; fetchedAt: string };
        }
      | { state: 'disabled' }
    >();

    expectTypeOf(z.string()).toMatchTypeOf<ZodType<string>>();
  });
});
