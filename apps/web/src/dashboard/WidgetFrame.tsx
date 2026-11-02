import { relativeTime, type WidgetPayload } from '@jos/core';
import type { ReactNode } from 'react';
import { useNow } from './useNow.js';

export type WidgetFrameProps<T> = {
  title: string;
  payload?: WidgetPayload<T>;
  isLoading: boolean;
  onRetry: () => void;
  actions?: ReactNode;
  children: (data: T) => ReactNode;
};

export function WidgetFrame<T>({
  title,
  payload,
  isLoading,
  onRetry,
  actions,
  children,
}: WidgetFrameProps<T>) {
  const now = useNow();

  return (
    <article className="widget-frame" aria-label={title}>
      <header className="widget-frame__header">
        <h2 className="widget-frame__title">{title}</h2>
        {payload?.state === 'ok' && payload.stale ? (
          <span className="widget-frame__stale">stale</span>
        ) : null}
        {actions}
      </header>

      {isLoading && payload === undefined ? (
        <div className="widget-frame__skeleton" aria-busy="true">
          Loading…
        </div>
      ) : null}

      {payload?.state === 'disabled' ? (
        <p className="widget-frame__disabled">Not configured</p>
      ) : null}

      {payload?.state === 'error' ? (
        <>
          <div className="widget-frame__error" role="alert">
            <p>{payload.error}</p>
            <button type="button" onClick={onRetry}>
              Try again
            </button>
          </div>
          {payload.lastGood ? children(payload.lastGood.data) : null}
        </>
      ) : null}

      {payload?.state === 'ok' ? (
        <>
          <p className="widget-frame__fetched">
            {relativeTime(new Date(payload.fetchedAt), now)}
          </p>
          {children(payload.data)}
        </>
      ) : null}
    </article>
  );
}
