# Task 1 acceptance — 2026-10-13

Baseline: `44d5a543c8781205b10912e99b5268eaa873d03b`. Implementation is on `feat/rental-hub-app-images`; use `git log` for the per-task commits.

Verified locally on Node 24.18.0 and Chrome, using the production Vite preview at `http://127.0.0.1:5173`.

- Building create/edit/delete, case-insensitive trimmed search, nonempty fields, positive integer floors, missing IDs, linked-room deletion guard and floor reduction guard: unit and browser checks.
- Room create/edit/delete, building references, duplicate numbers, floor bounds, finite area, nonnegative whole VND, occupied/available/maintenance and combined building/status filters: unit and browser checks.
- Booking create/edit/cancel, real leap dates, half-open overlap boundaries, self-exclusion, cancellation history, inactive buildings and maintenance rooms on every edit: unit and browser checks.
- Persistence/reload, empty data stays empty, legacy version 0/absent images, version 1 writes, corrupt JSON/schema remains intact, export before confirmed reset, failed writes retain memory and display a reactive warning: unit and browser checks.
- Production deep links and 404, no page errors, labels, dialog Tab/Escape/focus restoration, responsive widths 320/768/1024/1440: browser checks.

Commands: `npm run typecheck`, `npm test` (23 passing), `npm run build`, `npm run test:e2e` (10 passing). Build emits `dist/index.html` with existing hashed CSS/JS. Browser evidence is in the executable `tests/e2e/app.spec.ts`; all customers and test addresses are synthetic. Playwright's inherited NO_COLOR/FORCE_COLOR warning is a runner warning, not an app Console error.

Compatibility decisions: retain `roomNumber`/`rentalPrice`, the existing storage key, and legacy building `maintenance`; accept both envelope versions 0 and 1. Normalization happens in memory without rewriting a stored original on hydrate. The existing node:test runner replaces the plan's illustrative Vitest commands. Zustand still owns mutations; its synchronous storage subscription makes write failures recoverable without rolling back memory.

Limits: localStorage is per browser/origin. An unsaved change is lost on refresh. Export/download does not guarantee the user retained a backup. These checks do not certify the deployed VPS/AWS or HTTPS; those belong to the separate Deployment plan.
