import { relativeTime } from '@jos/core';
import { type FormEvent, type ReactNode, useEffect, useRef } from 'react';
import { useNow } from '../dashboard/useNow.js';
import { Kbd, StatusDot } from '../ui/primitives.js';
import { useDensity } from './useDensity.js';
import { countByStatus, type SourceStatus, useSources } from './useSources.js';

export type View = { id: string; label: string; href: string };

/** Every place the command bar and side nav can go. Add new views here. */
export const views: View[] = [
  { id: 'dashboard', label: 'dashboard', href: '/' },
  { id: 'passkeys', label: 'passkeys', href: '/settings/passkeys' },
];

export function findView(query: string): View | undefined {
  const q = query.trim().toLowerCase();
  if (q === '') {
    return undefined;
  }
  return (
    views.find((view) => view.label.startsWith(q)) ??
    views.find((view) => view.label.includes(q))
  );
}

type AppShellProps = {
  path: string;
  children: ReactNode;
};

/**
 * The signed-in frame: status bar, command bar, side nav and status line.
 * Pages render as children in the scrolling main column.
 */
export function AppShell({ path, children }: AppShellProps) {
  const sources = useSources();
  const [density, toggleDensity] = useDensity();
  const now = useNow();
  const current = views.find((view) => view.href === path) ?? views[0];
  const list = sources.data ?? [];
  const counts = countByStatus(list);

  return (
    <div className="shell">
      <header className="topbar">
        <span className="topbar__logo">◆ jackson-os</span>
        <span className="topbar__seg">
          ~/<b>{current?.label}</b>
        </span>
        <span className="topbar__seg">
          sources{' '}
          {sources.isError ? (
            <b className="t-mute">unavailable</b>
          ) : (
            <>
              <b className="t-ok">{counts.ok} ok</b>{' '}
              {counts.error > 0 ? (
                <b className="t-err">{counts.error} err</b>
              ) : null}{' '}
              {counts.disabled > 0 ? (
                <b className="t-mute">{counts.disabled} off</b>
              ) : null}
            </>
          )}
        </span>
        <span className="wf__spacer" />
        <button
          type="button"
          className="btn--icon"
          onClick={toggleDensity}
          aria-label={`Density: ${density}. Switch density`}
        >
          {density === 'compact' ? '▤ compact' : '▥ comfy'}
        </button>
        <time className="topbar__seg topbar__date" dateTime={now.toISOString()}>
          {now.toLocaleDateString(undefined, {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
          })}{' '}
          <b>
            {now.toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </b>
        </time>
      </header>

      <CommandBar />

      <div className="shell__body">
        <nav className="sidenav" aria-label="Main">
          <h3 className="sidenav__heading">views</h3>
          {views.map((view) => (
            <a
              key={view.id}
              className={
                view.id === current?.id
                  ? 'sidenav__link is-on'
                  : 'sidenav__link'
              }
              href={view.href}
              aria-current={view.id === current?.id ? 'page' : undefined}
            >
              {view.label}
            </a>
          ))}
          <h3 className="sidenav__heading">sources</h3>
          {list.length === 0 ? (
            <span className="sidenav__link t-mute">
              {sources.isLoading ? 'loading…' : 'none'}
            </span>
          ) : (
            list.map((source) => (
              <SourceRow key={source.id} source={source} now={now} />
            ))
          )}
        </nav>

        <main className="shell__main scroll">{children}</main>
      </div>

      <footer className="statusline">
        <span>
          <b>◆</b> jos
        </span>
        <span>{list.length} sources</span>
        <span className="wf__spacer" />
        <span>
          <b>⌘K</b> command
        </span>
        <span>
          <b>e</b> edit (dashboard)
        </span>
      </footer>
    </div>
  );
}

function SourceRow({ source, now }: { source: SourceStatus; now: Date }) {
  const meta =
    source.status === 'disabled'
      ? 'off'
      : source.lastFetchAt
        ? relativeTime(new Date(source.lastFetchAt), now)
        : '—';
  return (
    <span className="sidenav__link" title={source.displayName}>
      <StatusDot status={source.status} />
      {source.id}
      <span
        className={
          source.status === 'error' ? 'sidenav__meta t-err' : 'sidenav__meta'
        }
      >
        {source.status === 'error' ? 'err' : meta}
      </span>
    </span>
  );
}

function CommandBar() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const view = findView(inputRef.current?.value ?? '');
    if (view) {
      window.location.href = view.href;
    }
  };

  return (
    <form className="cmdbar" onSubmit={onSubmit}>
      <span className="cmdbar__prompt" aria-hidden="true">
        &gt;
      </span>
      <label className="sr-only" htmlFor="cmdbar-input">
        Command
      </label>
      <input
        id="cmdbar-input"
        ref={inputRef}
        type="text"
        list="cmdbar-views"
        autoComplete="off"
        placeholder="jump to a view…"
      />
      <datalist id="cmdbar-views">
        {views.map((view) => (
          <option key={view.id} value={view.label} />
        ))}
      </datalist>
      <Kbd>⌘K</Kbd>
    </form>
  );
}
