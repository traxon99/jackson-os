import type { ReactNode } from 'react';
import { ClockWidget } from './demo/Clock.js';
import { SeriesWidget } from './demo/Series.js';
import {
  JimBackendWidget,
  JimBodyWidget,
  JimLiftsWidget,
  JimNextWidget,
  JimPrsWidget,
  JimRecentWidget,
  JimStatusWidget,
  JimWeekWidget,
} from './jim/index.js';

export type WidgetComponent<T = unknown> = {
  View: (props: { data: T }) => ReactNode;
  actions?: (ctx: { id: string; invalidate: () => void }) => ReactNode;
};

const registry: Record<string, WidgetComponent<unknown>> = {
  'demo.clock': ClockWidget as WidgetComponent<unknown>,
  'demo.series': SeriesWidget as WidgetComponent<unknown>,
  'jim.status': JimStatusWidget as WidgetComponent<unknown>,
  'jim.week': JimWeekWidget as WidgetComponent<unknown>,
  'jim.recent': JimRecentWidget as WidgetComponent<unknown>,
  'jim.prs': JimPrsWidget as WidgetComponent<unknown>,
  'jim.lifts': JimLiftsWidget as WidgetComponent<unknown>,
  'jim.body': JimBodyWidget as WidgetComponent<unknown>,
  'jim.next': JimNextWidget as WidgetComponent<unknown>,
  'jim.backend': JimBackendWidget as WidgetComponent<unknown>,
};

export function getWidgetComponent(id: string): WidgetComponent | undefined {
  return registry[id];
}
