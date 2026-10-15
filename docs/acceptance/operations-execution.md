# Deployment/Operations execution — 2026-10-14

Base: `512f7f9`. Branch: `feat/rental-hub-operations`.

Scope: Task 2, remaining Task 4–5. Task 1 and Images already accepted. Task 3 accepted by the user and excluded from further implementation. AWS and VPS remain independent.

Ruling: The user's request authorizes remaining implementation and supersedes the old proposal-only status. No paid resources may be created; Hostinger VPS was declined due cost. Public VPS acceptance remains out of scope until a zero-cost VPS/access exists.
Ruling: Use the existing node:test/Playwright stack and Bash deployment scripts; no new CI service, database, Docker deployment, or AWS infrastructure.
Ruling: Implement VPS in an isolated worktree. Linux sandbox verification uses Ubuntu WSL with unpacked tools; it is not evidence of a public VPS.
Ruling: Task 4 AWS uses its existing S3/CloudFront architecture, with separate version rollback instructions/scripts. Do not deploy new media infrastructure or run disruptive AWS drills.

## Interface review

- 2.2 → 4.1: exact commit releases, shared assets/images and manifest paths agree.
- 2.3 → 4.2: existing media entry is `server-dist/server/main.js`; reads its own release manifest, supports read-only candidate and loopback port.
- 4.1 → 4.2/4.3: one shared lock, complete immutable release, same integrity checks for deploy and rollback.
- 4.2 → 5.1: VPS smoke requires health/manifest/real assets and strict missing-file 404; AWS retains its independently documented CloudFront fallback.
- 5.2: fault drills only in isolated Linux sandbox. Never alter live AWS firewall, storage, or permissions.

## Progress

- Task 2: implementation and Linux/Nginx/systemd/HTTPS/upload sandbox verification complete; deployment and acceptance on the independent VPS remain pending.
- Task 4: VPS atomic release/rollback fixtures and AWS mocked VersionId rollback complete at this checkpoint; later AWS live evidence is recorded in `task-4.md`. Independent VPS evidence remains pending.
- Task 5: 46 unit/API tests, lint/typecheck, Playwright 13/13 on local HTTPS, and sandbox 502/403/404 recovery complete at this checkpoint; independent VPS evidence remains pending.

Local evidence SHA: `67c5a2978f2226175097f130f7391aa7045d1940`. Nginx ran as `www-data`; media ran under a separate unprivileged systemd identity; a disposable Basic Auth fixture protected HTTPS upload. No AWS API calls, paid VPS, domain, or DNS changes were made. Task 3 remains accepted by the user and untouched.
