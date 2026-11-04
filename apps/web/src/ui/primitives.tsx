import {
  Children,
  type CSSProperties,
  isValidElement,
  type ReactNode,
} from 'react';
import { computeDelta } from './delta.js';
import { sparklinePoints } from './sparkline.js';

/*
 * Small building blocks every widget shares. Keep them dumb: no data fetching,
 * no layout opinions beyond their own box. Styles live in styles/app.css.
 */

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'err';

/** A bordered uppercase label: TRAIN, STALE, ERR, PASS. */
export function Tag({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return <span className={`tag tag--${tone}`}>{children}</span>;
}

export type Status = 'ok' | 'error' | 'disabled' | 'warn';

/** A square status marker. Always pair it with a word next to it. */
export function StatusDot({ status }: { status: Status }) {
  return <span className={`dot dot--${status}`} aria-hidden="true" />;
}

/** A tiny trend line. Decorative unless given a label. */
export function Sparkline({
  values,
  width = 64,
  height = 20,
  label,
  fill = false,
  className,
}: {
  values: readonly number[];
  width?: number;
  height?: number;
  label?: string;
  fill?: boolean;
  className?: string;
}) {
  const points = sparklinePoints(values, width, height);
  const svgClass = ['sparkline', className].filter(Boolean).join(' ');
  const viewBox = `0 0 ${width} ${height}`;
  const marks = (
    <>
      {fill && points !== '' ? (
        <polygon
          className="sparkline__area"
          points={`${points} ${width},${height} 0,${height}`}
        />
      ) : null}
      <polyline
        className="sparkline__line"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </>
  );

  if (label === undefined) {
    return (
      <svg
        className={svgClass}
        viewBox={viewBox}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {marks}
      </svg>
    );
  }

  return (
    <svg
      className={svgClass}
      viewBox={viewBox}
      preserveAspectRatio="none"
      role="img"
    >
      <title>{label}</title>
      {marks}
    </svg>
  );
}

/** A thin progress bar. `value` is 0..1. */
export function Meter({ value, label }: { value: number; label: string }) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <span className="meter">
      <span className="sr-only">
        {label}: {Math.round(clamped * 100)}%
      </span>
      <span
        className="meter__fill"
        aria-hidden="true"
        style={{ width: `${clamped * 100}%` }}
      />
    </span>
  );
}

/** Change vs a previous value: ▲ 12%, ▼ 3%, = 0%, or new. */
export function Delta({
  current,
  previous,
  goodWhen = 'up',
}: {
  current: number;
  previous: number | null | undefined;
  goodWhen?: 'up' | 'down' | 'neither';
}) {
  const result = computeDelta(current, previous);
  let text: string;
  let className = 't-mute';

  if (result.kind === 'new') {
    text = 'new';
  } else if (result.kind === 'same') {
    text = '= 0%';
  } else if (result.kind === 'up') {
    text = `▲ ${result.pct}%`;
    if (goodWhen === 'neither') {
      className = 't-mute';
    } else if (goodWhen === 'up') {
      className = 't-ok';
    } else {
      className = 't-err';
    }
  } else {
    text = `▼ ${result.pct}%`;
    if (goodWhen === 'neither') {
      className = 't-mute';
    } else if (goodWhen === 'down') {
      className = 't-ok';
    } else {
      className = 't-err';
    }
  }

  return <span className={className}>{text}</span>;
}

/** Compact table rows aligned on a CSS grid. */
export function Rows({
  columns,
  children,
  label,
}: {
  columns: string;
  children: ReactNode;
  label?: string;
}) {
  const style: CSSProperties = { gridTemplateColumns: columns };
  return (
    // biome-ignore lint/a11y/useSemanticElements: shared grid uses display:contents on rows
    <div role="table" aria-label={label} className="rows" style={style}>
      {children}
    </div>
  );
}

/** One row inside `Rows`. Link the first cell with `href`. */
export function Row({
  children,
  href,
  linkCell = 0,
}: {
  children: ReactNode;
  href?: string;
  linkCell?: number;
}) {
  const cells = Children.toArray(children);
  return (
    // biome-ignore lint/a11y/useSemanticElements: row wrapper uses display:contents
    // biome-ignore lint/a11y/useFocusableInteractive: presentational row in grid table
    <div role="row" className="rows__row">
      {cells.map((child, index) => {
        const key = isValidElement(child) ? child.key : index;
        const content =
          index === linkCell && href !== undefined ? (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {child}
            </a>
          ) : (
            child
          );
        return (
          // biome-ignore lint/a11y/useSemanticElements: cell aligns via parent grid
          <span role="cell" className="rows__cell" key={key ?? index}>
            {content}
          </span>
        );
      })}
    </div>
  );
}

/** A KPI tile: label, big value with unit, a delta line, optional sparkline. */
export function Stat({
  label,
  value,
  unit,
  delta,
  tone = 'neutral',
  trend,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: ReactNode;
  tone?: Tone;
  trend?: readonly number[];
}) {
  return (
    <div className="stat">
      <span className="t-label">{label}</span>
      <div className="stat__row">
        <span className="stat__value">
          {value}
          {unit ? <span className="stat__unit">{unit}</span> : null}
        </span>
        {trend ? <Sparkline values={trend} /> : null}
      </div>
      {delta ? (
        <span className={`stat__delta tone--${tone}`}>{delta}</span>
      ) : null}
    </div>
  );
}

/** A keyboard hint, like ⌘K. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
