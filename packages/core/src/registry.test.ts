import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { SourceAdapter, WidgetDef } from './contracts.js';
import { createRegistry } from './registry.js';

const stubAdapter = (id: string): SourceAdapter => ({
  id,
  displayName: id,
  configSchema: z.object({}),
  datasets: {
    main: {
      schema: z.object({ value: z.number() }),
      refresh: { everyMs: 1000, staleAfterMs: 2000 },
      fetch: async () => ({ value: 1 }),
    },
  },
});

const stubWidget = (
  id: string,
  source: string,
  dataset = 'main',
): WidgetDef => ({
  id,
  source,
  dataset,
  title: id,
  sizes: { default: { w: 1, h: 1 }, min: { w: 1, h: 1 } },
});

describe('createRegistry', () => {
  it('throws on duplicate source registration', () => {
    const registry = createRegistry();
    registry.registerSource(stubAdapter('demo'));
    expect(() => registry.registerSource(stubAdapter('demo'))).toThrow(
      /source already registered/,
    );
  });

  it('throws on duplicate widget registration', () => {
    const registry = createRegistry();
    registry.registerSource(stubAdapter('demo'));
    registry.registerWidget(stubWidget('demo.a', 'demo'));
    expect(() => registry.registerWidget(stubWidget('demo.a', 'demo'))).toThrow(
      /widget already registered/,
    );
  });

  it('throws when widget source is unknown', () => {
    const registry = createRegistry();
    expect(() =>
      registry.registerWidget(stubWidget('demo.a', 'missing')),
    ).toThrow(/unknown source/);
  });

  it('throws when widget dataset is unknown', () => {
    const registry = createRegistry();
    registry.registerSource(stubAdapter('demo'));
    expect(() =>
      registry.registerWidget(stubWidget('demo.a', 'demo', 'missing')),
    ).toThrow(/unknown dataset/);
  });

  it('lists registered sources and widgets', () => {
    const registry = createRegistry();
    const source = stubAdapter('demo');
    const widget = stubWidget('demo.a', 'demo');
    registry.registerSource(source);
    registry.registerWidget(widget);

    expect(registry.getSource('demo')).toBe(source);
    expect(registry.getWidget('demo.a')).toBe(widget);
    expect(registry.listSources()).toEqual([source]);
    expect(registry.listWidgets()).toEqual([widget]);
  });
});
