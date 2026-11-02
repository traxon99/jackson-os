import { describe, expect, it } from 'vitest';
import type { AdapterContext, Logger } from '../contracts.js';
import { createRegistry } from '../registry.js';
import {
  clockDataset,
  demoAdapter,
  registerDemo,
  seriesDataset,
} from './index.js';

function stubContext(
  overrides: Partial<AdapterContext<Record<string, never>>> = {},
): AdapterContext<Record<string, never>> {
  const log: Logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
  return {
    config: {},
    fetch: globalThis.fetch,
    log,
    now: () => new Date('2026-01-01T12:00:00.000Z'),
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe('demo adapter', () => {
  it('validates clock dataset schema', async () => {
    const data = await clockDataset.fetch(stubContext());
    expect(() => clockDataset.schema.parse(data)).not.toThrow();
    expect(data.iso).toBe('2026-01-01T12:00:00.000Z');
  });

  it('validates series dataset schema with deterministic points', async () => {
    const data = await seriesDataset.fetch(stubContext());
    expect(() => seriesDataset.schema.parse(data)).not.toThrow();
    expect(data).toHaveLength(20);
    const again = await seriesDataset.fetch(stubContext());
    expect(again).toEqual(data);
  });

  it('runs noop action with validated input', async () => {
    const action = demoAdapter.actions?.noop;
    expect(action).toBeDefined();
    const input = action?.input.parse({ note: 'hello' });
    expect(input).toEqual({ note: 'hello' });
    expect(() => action?.input.parse({ note: 'x'.repeat(101) })).toThrow();
    const result = await action?.run(stubContext(), { note: 'hello' });
    expect(result).toEqual({ ok: true });
    expect(action?.invalidates).toEqual(['series']);
  });

  it('registers demo source and widgets', () => {
    const registry = createRegistry();
    registerDemo(registry);
    expect(registry.getSource('demo')).toBe(demoAdapter);
    expect(registry.listWidgets()).toHaveLength(2);
  });

  it('emits demo.value metrics from series', async () => {
    const data = await seriesDataset.fetch(stubContext());
    const metrics = seriesDataset.toMetrics?.(
      data,
      new Date('2026-01-01T12:00:00.000Z'),
    );
    expect(metrics?.every((m) => m.metric === 'demo.value')).toBe(true);
    expect(metrics).toHaveLength(20);
  });
});
