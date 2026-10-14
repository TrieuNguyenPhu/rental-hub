# Deployment/Operations execution — 2026-10-14

Base: `512f7f9`. Branch: `feat/rental-hub-operations`.

Scope: Task 2, remaining Task 4–5. Task 1 and Images already accepted. Task 3 accepted by the user and excluded from further implementation. AWS and VPS remain independent.

Ruling: The user's request authorizes remaining implementation and supersedes the old proposal-only status. No paid resources may be created; VPS account/access is still needed for public acceptance.
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

- Task 2: templates/runbook in progress; public VPS/SSH/domain evidence pending access.
- Task 4: release scripts and failure checks in progress.
- Task 5: production checks, sandbox drills, runbook and demo evidence in progress.
