import type { ReactNode } from 'react';
import { ClockWidget } from './demo/Clock.js';
import { SeriesWidget } from './demo/Series.js';

export type WidgetComponent<T = unknown> = {
  View: (props: { data: T }) => ReactNode;
  actions?: (ctx: { id: string; invalidate: () => void }) => ReactNode;
};

const registry: Record<string, WidgetComponent<unknown>> = {
  'demo.clock': ClockWidget as WidgetComponent<unknown>,
  'demo.series': SeriesWidget as WidgetComponent<unknown>,
};

export function getWidgetComponent(id: string): WidgetComponent | undefined {
  return registry[id];
}
