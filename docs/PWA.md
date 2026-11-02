Add the lesson in the PR that fixes the bug.

This document tracks PWA lessons from `traxon99/jim` (parent issue #12) and where jackson-os implements them.

## Applying from Jim

| #   | Lesson                                                                               | Implementation in this repo                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Layout model: fixed viewport, single scroll container, `h-lvh`, `min-h-0` flex chain | Not shipped yet (dashboard shell).                                                                                                                                                                     |
| 2   | `overscroll-behavior: none` on `:root`                                               | Not shipped yet.                                                                                                                                                                                       |
| 3   | Safe areas: `viewport-fit=cover`, pad fixed chrome                                   | [`apps/web/index.html`](../apps/web/index.html) (`viewport-fit=cover`); component padding lands with the dashboard shell.                                                                              |
| 4   | 16px minimum input font; `touch-action: manipulation` in base CSS                    | Not shipped yet.                                                                                                                                                                                       |
| 5   | Native-feel rules gated on standalone (`body.pwa`)                                   | [`apps/web/src/pwa/InstallHint.tsx`](../apps/web/src/pwa/InstallHint.tsx) (standalone detection for the install hint).                                                                                 |
| 6   | Refetch on resume (`visibilitychange`); avoid stale mount memoization                | [`apps/web/src/pwa/focus-manager.ts`](../apps/web/src/pwa/focus-manager.ts), wired from [`apps/web/src/main.tsx`](../apps/web/src/main.tsx).                                                           |
| 7   | Service worker: cache hashed static assets only; never cache `/api/*`                | Not shipped yet.                                                                                                                                                                                       |
| 8   | SW update + foreground update checks                                                 | Not shipped yet.                                                                                                                                                                                       |
| 9   | Per-device splash screens                                                            | [`apps/web/scripts/gen-splash.mjs`](../apps/web/scripts/gen-splash.mjs), [`apps/web/public/splash/`](../apps/web/public/splash/), [`apps/web/index.html`](../apps/web/index.html) startup-image links. |

Shared installability baseline: [`apps/web/public/manifest.webmanifest`](../apps/web/public/manifest.webmanifest), icons from [`apps/web/scripts/generate-pwa-icons.mjs`](../apps/web/scripts/generate-pwa-icons.mjs).

## Deliberately not copying

- **Install gate** — data lives on the server; we show a dismissible hint instead ([`apps/web/src/pwa/InstallHint.tsx`](../apps/web/src/pwa/InstallHint.tsx)).
- **Dexie / offline write sync** — v1 actions require network.
- **Web Push** — deferred to later milestone work.
