# Image acceptance — 2026-10-13

Branch: `feat/rental-hub-app-images`; baseline `44d5a543c8781205b10912e99b5268eaa873d03b`. Image processing introduced after App task 1.5 (`250a387`).

I.1: `node --experimental-strip-types --test server/images.test.ts` passes 5 tests. `npm run typecheck`, `npm test` (28 passing), `npm run build:media` pass. Tests decode actual generated WebP and check dimensions, byte counts, MIME mismatch, fake content, frame count, EXIF orientation/stripping, 10 MiB/20 MP/1199px rejection, and second output ENOSPC cleanup. No incomplete pair is published.

Three real, non-sensitive photographic samples were downloaded for local measurement and visually inspected (no people). Inputs are JPEG 1600×1067, outputs WebP 600×400 and 1200×800, quality 80; all dimensions were decoded with Sharp. Source and uploaded samples are scratch files outside Git, not app/demo assets.

| Sample | Source bytes | 600 bytes | 1200 bytes |
|---|---:|---:|---:|
| House exterior | 441,642 | 50,970 | 165,448 |
| Dining interior | 276,621 | 25,880 | 72,042 |
| Living room | 284,008 | 31,096 | 85,790 |

Sample sources: [house](https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=90&fm=jpg), [dining](https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1600&q=90&fm=jpg), [living room](https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1600&q=90&fm=jpg). This proves reduction on this sample set, not a universal compression ratio.

Implementation references: [Sharp input metadata](https://sharp.pixelplumbing.com/api-input/), [orientation](https://sharp.pixelplumbing.com/api-operation/#autoorient), [resize](https://sharp.pixelplumbing.com/api-resize/) and [output](https://sharp.pixelplumbing.com/api-output/).

I.2 API and I.3 UI evidence will be recorded after their checks. HTTPS/Basic Auth and rollback checksum checks require the separate Deployment/Operations plans and are not locally certified.

I.2: 10 real loopback HTTP tests pass, covering success/health/404, Origin, ID traversal, declared/streamed byte limits, decoding, 429 during body reads and encoding, failure recovery, ENOSPC→507, 30-second body deadline, read-only startup, owned stale-temp cleanup, unavailable writes, different filesystem rejection, confined development WebP serving and production static 404. Full suite: 38 passing. A CLI curl upload of the house JPEG returned 201 with two files (50,970/165,448 bytes, widths600/1200); GET health returned local-dev, and Get-NetTCPConnection confirmed only 127.0.0.1:3001 was listening. Build-media and typecheck pass. API returns generic errors and logs only method/status/releaseId. Internet HTTPS/Basic Auth remains a Deployment integration check.
