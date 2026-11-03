import { relativeTime, type WidgetPayload } from '@jos/core';
import type { ReactNode } from 'react';
import { Tag } from '../ui/primitives.js';
import { useNow } from './useNow.js';

export type WidgetFrameProps<T> = {
  title: string;
  /** Source id shown next to the title, e.g. `jim` or `github`. */
  source?: string;
  payload?: WidgetPayload<T>;
  isLoading: boolean;
  onRetry: () => void;
  actions?: ReactNode;
  children: (data: T) => ReactNode;
};

/**
 * The one frame every widget renders inside. It owns the header (title,
 * source, age, status tag, actions) and the four payload states, so widget
 * views only ever draw their data.
 */
export function WidgetFrame<T>({
  title,
  source,
  payload,
  isLoading,
  onRetry,
  actions,
  children,
}: WidgetFrameProps<T>) {
  const now = useNow();
  const state = payload?.state ?? (isLoading ? 'loading' : 'empty');

  return (
    <article className={`wf wf--${state}`} aria-label={title}>
      <header className="wf__header">
        <h2 className="wf__title">{title}</h2>
        {source ? <span className="wf__source">· {source}</span> : null}
        <span className="wf__spacer" />
        {payload?.state === 'ok' && payload.stale ? (
          <Tag tone="warn">stale</Tag>
        ) : null}
        {payload?.state === 'error' ? <Tag tone="err">err</Tag> : null}
        {payload?.state === 'ok' ? (
          <span className="wf__age">
            {relativeTime(new Date(payload.fetchedAt), now)}
          </span>
        ) : null}
        {payload?.state === 'error' && payload.lastGood ? (
          <span className="wf__age">
            last good {relativeTime(new Date(payload.lastGood.fetchedAt), now)}
          </span>
        ) : null}
        {actions ? <span className="wf__actions">{actions}</span> : null}
      </header>

      <div className="wf__body">
        {isLoading && payload === undefined ? (
          <div className="wf__skeleton" aria-busy="true">
            <span className="sr-only">Loading…</span>
            <span className="wf__skeleton-row" />
            <span className="wf__skeleton-row" />
            <span className="wf__skeleton-row" />
          </div>
        ) : null}

        {payload?.state === 'disabled' ? (
          <p className="wf__disabled">Not configured</p>
        ) : null}

        {payload?.state === 'error' ? (
          <>
            <div className="wf__error" role="alert">
              <p>{payload.error}</p>
              <button type="button" onClick={onRetry}>
                Try again
              </button>
            </div>
            {payload.lastGood ? (
              <div className="wf__last-good">
                {children(payload.lastGood.data)}
              </div>
            ) : null}
          </>
        ) : null}

        {payload?.state === 'ok' ? children(payload.data) : null}
      </div>
    </article>
  );
}
