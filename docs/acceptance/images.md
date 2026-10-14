# Image acceptance — 2026-10-13

Branch: `feat/rental-hub-app-images`; baseline `44d5a543c8781205b10912e99b5268eaa873d03b`. Image processing introduced after App task 1.5 (`250a387`).

I.1: `node --experimental-strip-types --test tests/media/images.test.ts` passes 5 tests. `npm run typecheck`, `npm test` (28 passing), `npm run build:media` pass. Tests decode actual generated WebP and check dimensions, byte counts, MIME mismatch, fake content, frame count, EXIF orientation/stripping, 10 MiB/20 MP/1199px rejection, and second output ENOSPC cleanup. No incomplete pair is published.

Three real, non-sensitive photographic samples were downloaded for local measurement and visually inspected (no people). Inputs are JPEG 1600×1067, outputs WebP 600×400 and 1200×800, quality 80; all dimensions were decoded with Sharp. Source and uploaded samples are scratch files outside Git, not app/demo assets.

| Sample | Source bytes | 600 bytes | 1200 bytes |
|---|---:|---:|---:|
| House exterior | 441,642 | 50,970 | 165,448 |
| Dining interior | 276,621 | 25,880 | 72,042 |
| Living room | 284,008 | 31,096 | 85,790 |

Sample sources: [house](https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=90&fm=jpg), [dining](https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1600&q=90&fm=jpg), [living room](https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1600&q=90&fm=jpg). This proves reduction on this sample set, not a universal compression ratio.

Implementation references: [Sharp input metadata](https://sharp.pixelplumbing.com/api-input/), [orientation](https://sharp.pixelplumbing.com/api-operation/#autoorient), [resize](https://sharp.pixelplumbing.com/api-resize/) and [output](https://sharp.pixelplumbing.com/api-output/).

I.2 API and I.3 UI evidence will be recorded after their checks. HTTPS/Basic Auth and rollback checksum checks require the separate Deployment/Operations plans and are not locally certified.

I.2: 10 real loopback HTTP tests pass, covering success/health/404, Origin, ID traversal, declared/streamed byte limits, decoding, 429 during body reads and encoding, failure recovery, ENOSPC→507, 30-second body deadline, read-only startup, owned stale-temp cleanup, unavailable writes, different filesystem rejection, confined development WebP serving and production static 404. Full suite: 38 passing. A CLI curl upload of the house JPEG returned 201 with two files (50,970/165,448 bytes, widths 600/1200); GET health returned local-dev, and Get-NetTCPConnection confirmed only 127.0.0.1:3001 was listening. Build-media and typecheck pass. API returns generic errors and logs only method/status/releaseId. Internet HTTPS/Basic Auth remains a Deployment integration check.

I.3: `npm run test:e2e` passes 14 tests (10 App +4 Images), using production preview and a real local media service. Created building/room before upload; verified actual image/webp responses, natural widths 600/1200, metadata375/750 heights, reload/link retention, max 5, unlink without DELETE or disk deletion, API413/422/429/507 and connection errors, busy picker, type/size checks, quota warning and broken-preview fallback. Image gallery has no horizontal dialog overflow at320/768/1024/1440; screenshot `.local/test-results/images-building-gallery.png` was inspected. `npm run typecheck`, `npm run lint`, `npm test` (38), frontend/media builds pass. Browser fixtures use synthetic images; compression proof uses the real samples above. Metadata is immediate on successful upload; closing the entity form does not undo image links.

Final implementation: 541c55bbd5fbcadbaa0010af4863575e5eb142aa. Fresh whole-branch review found 5 important issues; all were reproduced RED→GREEN in one fix pass: concurrent stale ownership, lock lifetime after client disconnect, stale UI upload completion, APNG, occupied-room booking creation. Empty input and unencodable WebP height were regraded important and fixed with regressions; max output height 16383 is now explicit. Additional malformed image-list and whitespace legacy-data regressions pass. Final suite 44/44 on Windows and Ubuntu Linux; Chrome 16/16; typecheck/lint/frontend/media builds pass, audit 0 vulnerabilities. Ubuntu used official Node 24.18.0 portable runtime with SHA256 checked against nodejs.org SHASUMS256.txt, and npm ci in an isolated /tmp workspace. Linux abstract-socket and Windows named-pipe ownership both passed the real server tests. See [Node IPC documentation](https://nodejs.org/api/net.html#ipc-support) for the OS-owned lock semantics.

A production-mode compiled entry in a temporary release directory read its own release.json and returned the full implementation SHA from GET health. It listened only on 127.0.0.1:3002, returned 503 READ_ONLY for an upload and 404 for /images. This validates the local candidate contract, not public Nginx/HTTPS/Basic Auth or rollback.
