# UI

Jackson OS looks like a terminal: orange on near-black, one monospace font (Paper Mono), square corners, thin rules. The look is there to serve four goals, in this order:

1. **Scannable.** You should be able to read any widget's state in one glance. Titles are short uppercase labels in the accent color. Status always shows a word (`OK`, `ERR`, `STALE`) next to its color, never color alone.
2. **Dense.** Show as much real information as fits. Use small type, tabular numbers, and tight rows. Leave out decoration, empty hero areas and large padding.
3. **Modular.** Every widget sits in the same `WidgetFrame` and is built from the same primitives. A new source should look finished without any CSS of its own.
4. **Calm.** Use one accent color. The status colors (ok/warn/err) only mark state.

The design mockup (desktop, phone, and widget states) lives in the project's design canvas. Treat it as the target, not as a spec.

## Where things live

| File                                     | What it holds                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/web/src/styles/tokens.css`         | Every color, size and font as a CSS custom property, plus the density modes.                     |
| `apps/web/src/styles/theme.css`          | The Paper Mono `@font-face`, element defaults (buttons, inputs, links), auth and settings pages. |
| `apps/web/src/styles/app.css`            | Layout: the shell, dashboard grid, `WidgetFrame`, primitives.                                    |
| `apps/web/src/styles/base.css`           | PWA viewport rules from Jim (see [PWA.md](PWA.md)). Don't restyle here.                          |
| `apps/web/src/shell/AppShell.tsx`        | The top bar, command bar (⌘K), side nav with live source health, and status line.                |
| `apps/web/src/dashboard/WidgetFrame.tsx` | The widget header and the loading, ok/stale, error and disabled states.                          |
| `apps/web/src/ui/primitives.tsx`         | `Tag`, `StatusDot`, `Sparkline`, `Meter`, `Stat`, `Kbd`, `Rows`, `Row`, `Delta`.                 |
| `apps/web/src/assets/fonts/paper-mono/`  | The self-hosted Paper Mono variable font (weights 300–700) and its OFL license.                  |

## Tokens

Use the tokens. Don't use hex values in components.

| Token                                                 | Use                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| `--bg`, `--surface-1`, `--surface-2`                  | Page background, widget background, hover and track fills. |
| `--line`, `--line-strong`                             | Dividers and borders.                                      |
| `--text`, `--text-dim`, `--text-mute`                 | Primary, secondary, and label text. All three pass 4.5:1.  |
| `--accent`                                            | Widget titles, the primary button, active nav, charts.     |
| `--ok`, `--warn`, `--err`                             | State only, always next to a word.                         |
| `--fs-*`, `--row-pad`, `--gap`, `--pad`, `--header-h` | Type scale and spacing. These follow the density mode.     |

**Density.** The default is compact. `<html data-density="comfortable">` makes the type and spacing bigger, and the toggle in the top bar sets it (saved in localStorage). Phones always get 13px text and 44px tap targets.

## Building a widget view

A widget view only draws its data. `WidgetFrame` already handles the title, source, age, stale and error tags, the retry button, and the skeleton. Build the view from the primitives and plain markup:

```tsx
import { Meter, Sparkline, Tag } from '../../ui/primitives.js';

View: ({ data }) => (
  <>
    <span>
      <span className="t-label">open prs</span> {data.open}
      {data.failing > 0 ? <Tag tone="err">fail</Tag> : null}
    </span>
    <Sparkline
      values={data.commitsPerDay}
      width={140}
      height={28}
      label="Commits, 14 days"
    />
    <Meter value={data.done / data.total} label="M1 progress" />
  </>
);
```

Rules of thumb:

- Put the number first and the label after it. Use the `t-label` class for small uppercase labels.
- For tables of rows, use the `Rows` and `Row` primitives with CSS grid, `--row-pad`, and dashed `--line` separators. Keep cells on one line and truncate with an ellipsis.

```tsx
import { Row, Rows } from '../../ui/primitives.js';

<Rows columns="auto 1fr auto" label="Recent workouts">
  <Row href={workout.webUrl}>
    <span className="t-label">{workout.startedAt}</span>
    <span>{workout.name}</span>
    <span>{workout.durationMinutes}m</span>
  </Row>
</Rows>;
```

- Use `Delta` for “this vs last” (`▲ 12%`, `▼ 3%`, `= 0%`, or `new`). Set `goodWhen` to `'up'` or `'down'` so the tone matches what “better” means for that metric.
- Charts are inline SVG in `--accent`, with no axes unless they are needed. Give them a `label` when they carry meaning on their own.
- Header actions (`actions` on the widget) are small text buttons, like `run noop`. Real actions go through `POST /api/actions/...`.
- The CSP is `style-src 'self'`: React `style={{…}}` props are fine (they go through the CSSOM), but don't add `<style>` tags or style attributes in HTML strings, and don't load fonts from a CDN.
