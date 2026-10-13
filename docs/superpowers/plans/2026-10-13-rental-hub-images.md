# Building/Room Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload ảnh building/room, tạo hai WebP đúng width 600/1200, lưu ngoài release và tích hợp vào UI.

**Architecture:** Một API Node nhận body ảnh nhị phân; Sharp xác minh, auto-orient, resize và encode. Nginx xác thực/proxy API và phục vụ ảnh; Zustand chỉ giữ ImageAsset metadata.

**Tech Stack:** Node.js 24 LTS, TypeScript, node:http, node:fs, node:crypto, Sharp; React/TypeScript; Vitest, Playwright. Chỉ thêm Sharp cho encode, không Express/multipart/S3 trong baseline.

**Spec:** [Thiết kế §5–§6](../specs/2026-10-13-rental-hub-design.md).

## Global Constraints

- Tuân theo [Global Constraints tổng](2026-10-13-rental-hub.md#global-constraints); các limit bên dưới là đề xuất cần xác nhận.
- Width 600/1200 sau EXIF, giữ tỷ lệ, không crop, WebP quality 80; input width >=1200, <=10 MiB, <=20.000.000 pixel, JPEG/PNG/WebP một frame.
- Service loopback 3001, một ảnh đang xử lý, body timeout 30 giây; request song song bị từ chối 429.
- URL `/images/{building-image|room-image}/{entityId}/{imageId}/{unixSeconds}-{nonce}_{600|1200}.webp`.
- Upload qua HTTPS + Nginx Basic Auth; API kiểm tra Origin đúng SITE_ORIGIN. Không secret frontend, CORS wildcard hoặc server fetch URL người dùng.
- UI tối đa 5 ảnh/entity; bỏ liên kết không tự xóa file server. Ảnh demo public, metadata chỉ ở browser.

## Review Focus

- MIME giả/đuôi đổi nhưng không decode được: I.1.
- EXIF xoay làm đổi chiều, ảnh nhỏ/pixel lớn/nhiều frame: I.1.
- Ghi file thứ hai lỗi, body không có Content-Length, disk full: I.1/I.2.
- Origin/path traversal và request đồng thời: I.2.
- Upload fail/refresh/bỏ ảnh và checksum qua rollback: I.3, Operations 4.3.

## File và interfaces chung

- `src/types/index.ts`: thêm `ImageAsset` và images tương thích dữ liệu cũ.
- `server/images.ts`: decode/encode, temp + publish; `server/main.ts`: HTTP, config, health.
- `server/images.test.ts`, `server/main.test.ts`: test thực với buffer + temp disk/HTTP loopback; không gọi endpoint production.
- `server/tsconfig.json`: output `server-dist`; root package scripts `build:media`, `start:media`.
- `src/components/common/ImageUploader.tsx`: UI chung building/room; `src/components/buildings/BuildingForm.tsx`, `src/components/rooms/RoomForm.tsx`, store giữ metadata.
- `e2e/images.spec.ts`, `docs/acceptance/images.md`: nghiệm thu UI và resize/compression.

```ts
interface ImageAsset {
  id: string;
  url600: string;
  url1200: string;
  width600: 600;
  width1200: 1200;
  height600: number;
  height1200: number;
  bytes600: number;
  bytes1200: number;
}
type EntityType = 'building' | 'room';
type ImageTarget = { entityType: EntityType; entityId: string };
type MediaConfig = {
  host: '127.0.0.1'; port: number;
  imagesRoot: string; tempRoot: string; siteOrigin: string;
  releaseId: string; readOnly: boolean;
};
// ImagesRoot/TempRoot là directory tuyệt đối trên cùng filesystem.
processImage(input: Buffer, declaredType: string, target: ImageTarget,
  imagesRoot: string, tempRoot: string): Promise<ImageAsset>;
startMediaServer(config: MediaConfig): Promise<import('node:http').Server>;
```

Server lỗi phải có `code` và HTTP status theo spec; không lộ raw stack/path qua response. `readOnly: true` dành candidate, trả 503 cho POST và không dọn temp production.

### Task I.1: Xử lý và publish cặp ảnh

**Files:** types, `server/images.ts`, `server/images.test.ts`, server tsconfig, root package/lockfile.

**Interfaces:** Consumes ImageTarget + raw buffer + trusted roots; produces processImage và ImageAsset. Server sinh imageId/nonce; entity ID chỉ là identifier, không phải filesystem path tự do.

- [ ] **Step 1 — Viết test `images.producesPairedWebp`:** tạo nguồn JPEG 1600x1000 bằng Sharp trong test; gọi processImage vào temp directory; đọc metadata output, assert format webp, widths 600/1200, heights 375/750; byte counts khớp stat; URL cùng imageId/base filename và đúng suffix; cả hai file tồn tại.
- [ ] **Step 2 — Viết test validation:** `images.rejectsFakeAndUnsupported` nhận file giả JPEG/SVG/GIF; `images.rejectsLimits` nhận >10 MiB, width1199 và 21 MP; `images.orientsAndStripsMetadata` dùng JPEG EXIF orientation 6 (raw1000x1600 → oriented1600x1000), output đúng tỷ lệ và không có EXIF/GPS; animated WebP bị từ chối.
- [ ] **Step 3 — Viết test `images.secondWriteFailurePublishesNothing`:** mock chỉ write output thứ hai throw ENOSPC trong temp; assert không có published imageId và temp đã được dọn; API tầng trên ánh xạ 507. Không mock Sharp cho test encode thành công.
- [ ] **Step 4 — Chạy:** `npx vitest run server/images.test.ts`; xác minh missing behavior FAIL trước implementation.
- [ ] **Step 5 — Implement processImage:** decode với pixel limit, đối chiếu MIME thật, frame count và oriented width; two resize+webp outputs vào temp cùng filesystem, rename directory để publish; cleanup failure. Không giữ nguồn gốc hoặc thêm thumbnail thứ ba. Thêm một comment `shortcut:` cho việc không GC file đã bỏ liên kết và điều kiện nâng cấp khi có danh sách tham chiếu tập trung.
- [ ] **Step 6 — Kiểm chứng:** test PASS; `npm run build:media` exit0. Dùng ba ảnh chụp mẫu không nhạy cảm, ghi sourceBytes/600Bytes/1200Bytes và metadata thật vào acceptance; không dùng màu phẳng làm bằng chứng nén ảnh chụp hoặc hứa tỷ lệ giảm cho mọi input.
- [ ] **Step 7 — Commit:** `git commit -m "feat: generate paired WebP building and room images"`.

### Task I.2: API, health và ranh giới bảo mật

**Files:** `server/main.ts`, `server/main.test.ts`, `package.json`, `vite.config.ts`, `.env.example` chỉ config không secret; templates Nginx/systemd được thực hiện ở Deployment 2.2/2.3.

**Interfaces:** Consumes processImage; produces startMediaServer, POST/GET contract spec §5; config env `MEDIA_PORT`, `IMAGES_ROOT`, `TEMP_ROOT`, `SITE_ORIGIN`, `MEDIA_READ_ONLY`, `NODE_ENV`. Entry production đọc releaseId từ `release.json` thuộc release chứa entrypoint; test truyền releaseId qua MediaConfig. Development entry không cần manifest, dùng releaseId `local-dev` khi `NODE_ENV=development`. Mặc định NODE_ENV=production và host luôn loopback. Vite dev proxy `/api` và `/images` tới loopback; service chỉ serve `/images` khi NODE_ENV=development, production Nginx serve files trực tiếp.

- [ ] **Step 1 — Test `api.acceptsValidImage`:** HTTP loopback port ngẫu nhiên, valid Origin/body/Content-Type →201 ImageAsset; `GET /api/health` →200 đúng releaseId; thư mục không writable →503 health; unsupported route →404 JSON.
- [ ] **Step 2 — Test `api.boundsAndOrigin`:** Origin thiếu/sai →403; `entityType=other`, ID `../x`/slash/>64chars →400; header length >10MiB hoặc streamed body vượt limit không Content-Length →413; timeout30s dùng fake timer → timeout response/close; invalid MIME415/decode422; response không chứa secret/path.
- [ ] **Step 3 — Test `api.serializesAndReadOnly`:** giữ processImage request A đang pending, B →429; A hoàn thành thì C chạy; failure A giải phóng busy; readOnly POST→503 không gọi encoder/dọn temp; write ENOSPC→507.
- [ ] **Step 4 — Chạy:** `npx vitest run server/main.test.ts`.
- [ ] **Step 5 — Implement HTTP tối thiểu:** query validation trước body; bounded reads; request timeout; Origin allow đúng một origin cấu hình; error JSON rõ; health writable check qua file probe nhỏ có cleanup; log method/status/releaseId, không auth/body. Config thiếu/roots khác filesystem phải fail startup trước nhận request. Development GET `/images/...` chỉ serve từ imagesRoot sau kiểm tra path nằm trong root; test path traversal trả 400/404, WebP đúng MIME, missing file 404. Chạy production không có static image handler vì Nginx chịu trách nhiệm.
- [ ] **Step 6 — Kiểm chứng:** tests/build PASS; loopback curl đúng header/body trả201 và hai file; service không listen 0.0.0.0. HTTPS/Basic Auth integration chỉ đánh dấu PASS sau Deployment 2.3.
- [ ] **Step 7 — Commit:** `git commit -m "feat: add bounded image upload API"`.

### Task I.3: Upload, hiển thị và bỏ liên kết ở hai form

**Files:** `src/components/common/ImageUploader.tsx`, BuildingForm/RoomForm, trang danh sách/xem chi tiết khi đã có, store/types; `e2e/images.spec.ts`, `docs/acceptance/images.md`.

**Interfaces:** Consumes entity.id đã persist + ImageAsset + CRUD actions. Produces `ImageUploader({entityType, entityId, images, onChange}: {entityType: EntityType; entityId: string; images: ImageAsset[]; onChange: (images: ImageAsset[]) => void})`; component tự fetch relative `/api/images`, không tạo API client wrapper chỉ cho một endpoint.

- [ ] **Step 1 — Browser test `images.buildingAndRoomUpload`:** tạo entity trước, upload1600x1000 → preview600, view1200, metadata ở store; refresh cùng origin vẫn hiện; đạt5 ảnh thì disable chọn ảnh thứ6, vẫn đọc/xóa liên kết ảnh cũ được.
- [ ] **Step 2 — Browser test `images.failedUploadPreservesState`:** mock 413/422/429/507/network disconnect → lỗi rõ + ảnh cũ/metadata còn; entity chưa có ID thì hướng dẫn lưu entity trước; bỏ liên kết không gọi DELETE server; loading disable upload trùng.
- [ ] **Step 3 — Chạy E2E mới với service local:** `npm run test:e2e -- e2e/images.spec.ts`; xác minh fail thuộc flow chưa có.
- [ ] **Step 4 — Implement:** file picker label, check size/type sớm nhưng server vẫn kiểm tra; POST raw File với Content-Type; browser tự gửi Origin, không tự đặt header bị cấm; sau201 update images qua store. Không lưu blob URL/base64 bền vững; preview qua URL600 với alt text, ảnh lỗi có fallback. UI không lấy ảnh từ origin VPS khi đang AWS.
- [ ] **Step 5 — Kiểm chứng:** typecheck/unit/build/E2E PASS; browser Network nhìn Content-Type image/webp và width thực; upload building/room rồi refresh; quota storage khi thêm metadata hiện cảnh báo. Ghi kích thước/bytes/URL vào acceptance; metadata localStorage không đồng bộ giữa browser được nêu rõ.
- [ ] **Step 6 — Commit:** `git commit -m "feat: attach WebP images to buildings and rooms"`.
