# Rental Hub Website — Task 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thành hoặc nghiệm thu toàn bộ chức năng task 1, bao gồm giữ dữ liệu và bảo vệ quan hệ.

**Architecture:** React Router cung cấp ba trang; Zustand là nơi mutation và validation; localStorage lưu metadata. Helpers thuần kiểm tra dữ liệu, dates và overlap để dùng chung giữa form/store.

**Tech Stack:** React, TypeScript, Zustand, Vite, React Router; Vitest và Playwright nếu chưa có công cụ tương đương.

**Spec:** [Thiết kế §4 và §8](../specs/2026-10-13-rental-hub-design.md).

## Global Constraints

- Tuân theo [Global Constraints của kế hoạch tổng](2026-10-13-rental-hub.md#global-constraints).
- Task 1 đã hoàn thành theo người dùng: nghiệm thu trước, không viết lại nếu đạt. Paths/signatures dưới đây là mục tiêu chưa đối chiếu code.
- CRUD metadata theo browser/origin. Không database, API CRUD, phân quyền hoặc thiết kế UI phức tạp.
- ID chuỗi; ngày YYYY-MM-DD; tiền VND nguyên không âm; images mặc định [] và field cũ không có ảnh vẫn đọc được.

## Review Focus

- Chặn cascade mất dữ liệu: 1.2/1.3.
- Booking sát biên, leap date, sửa chính mình, lịch hủy: 1.4.
- NaN/Infinity, room duplicate, tầng vượt building: 1.2/1.3.
- localStorage không ghi được/hỏng JSON: 1.5.
- Confirm dialog keyboard và production browser thực: 1.5.

## Bản đồ file và contract

File mục tiêu: `src/types/index.ts`, `src/store/estateStore.ts`, `src/store/useEstateStore.ts`, `src/utils/{validDate,hasBookingOverlap,validateBuilding,validateRoom,validateBooking}.ts`, `src/components/{buildings/BuildingForm,rooms/RoomForm,bookings/BookingForm}.tsx`, `src/pages/{BuildingsPage,RoomsPage,BookingsPage}.tsx`, `src/App.tsx`, `src/data/createDemoData.ts`.

Nếu file hiện có khác, sửa mapping ở kế hoạch tổng trước thực thi. Không tự tạo helper/store thứ hai cạnh implementation đã có.

Contract mục tiêu:

```ts
type ActionResult = { ok: true; id: string } | { ok: false; error: string };
type BuildingInput = Omit<Building, 'id'>;
type RoomInput = Omit<Room, 'id'>;
type BookingInput = Omit<Booking, 'id' | 'status'>;
// Types chi tiết Building/Room/Booking/ImageAsset ở spec §4/§5.
// Một mutation thành công trả ID entity bị tác động.
addBuilding(input: BuildingInput): ActionResult;
updateBuilding(id: string, input: BuildingInput): ActionResult;
deleteBuilding(id: string): ActionResult;
addRoom(input: RoomInput): ActionResult;
updateRoom(id: string, input: RoomInput): ActionResult;
deleteRoom(id: string): ActionResult;
addBooking(input: BookingInput): ActionResult;
updateBooking(id: string, input: BookingInput): ActionResult;
cancelBooking(id: string): ActionResult;
```

`EstateState` có `buildings: Building[]`, `rooms: Room[]`, `bookings: Booking[]`, `storageWarning: string | null` và các action trên. `createEstateStore(storage: StateStorage): StoreApi<EstateState>` cho phép dùng memory storage hoặc throwing storage trong test; UI dùng hook hiện có. Runtime kiểm tra dữ liệu hydrate trước dùng; malformed data không được coi là dữ liệu hợp lệ chỉ nhờ ép kiểu TypeScript.

### Task 1.1: Types, state và build baseline

**Files:** Types/store/hook/App ở bản đồ trên; `package.json`, `package-lock.json`, `vitest.config.ts` nếu thiếu; `src/store/estateStore.test.ts`.

**Interfaces:** Consumes spec §4; produces types và `createEstateStore` cùng actions cho 1.2–1.5. ImageAsset contract ở kế hoạch ảnh, chưa cần UI upload.

- [x] **Step 1 — Nghiệm thu trước:** kiểm tra scripts/công cụ hiện có; chạy typecheck/build hiện tại. Nếu lỗi, ghi rõ baseline, không sửa lỗi ngoài scope.
- [x] **Step 2 — Test `estateStore.initializesAndPersistsMetadata`:** memory storage sạch → ba collection hợp lệ; add building hợp lệ → ID ổn định; store mới từ cùng storage → tìm lại ID đó; JSON không có Blob/base64.
- [x] **Step 3 — Chạy:** `npx vitest run src/store/estateStore.test.ts`; test mới FAIL nếu hành vi còn thiếu; nếu PASS không sửa code tương ứng.
- [x] **Step 4 — Hoàn thiện minimum:** types theo spec, actions hiện có tương đương contract; chuẩn hóa script `typecheck`, `test`, `build`, `test:e2e` nếu thiếu. Dùng lockfile, không nâng dependency không liên quan.
- [x] **Step 5 — Kiểm chứng:** `npm run typecheck`, `npx vitest run src/store/estateStore.test.ts`, `npm run build`; tất cả exit 0, dist/index.html tồn tại và trỏ assets có thật.
- [x] **Step 6 — Commit nếu có thay đổi:** stage đúng file task; `git commit -m "feat: define estate types and persistent state"`.

### Task 1.2: Building CRUD và tìm kiếm

**Files:** `src/utils/validateBuilding.ts`, `src/components/buildings/BuildingForm.tsx`, `src/pages/BuildingsPage.tsx`, store; `src/store/buildings.test.ts`.

**Interfaces:** Consumes Room[]/BuildingInput/ActionResult; produces `validateBuilding(input: BuildingInput, rooms: Room[], buildingId?: string): string | null`, building actions và trang `/buildings`.

- [x] **Step 1 — Test `buildings.crudAndGuardRelations`:** valid create/update giữ ID; whitespace-only name/address/city bị từ chối; floors 0/1.5/NaN/Infinity bị từ chối; xóa building có room thất bại và state không đổi; giảm floors dưới room.floor thất bại.
- [x] **Step 2 — Chạy:** `npx vitest run src/store/buildings.test.ts`; kiểm tra fail thuộc tính thiếu.
- [x] **Step 3 — Hoàn thiện:** validation store/form dùng chung; update/delete ID không tồn tại trả lỗi; tìm tên bằng trim + lowercase; nút xóa dùng confirm dialog đã có.
- [x] **Step 4 — Kiểm chứng:** unit PASS; browser tạo/sửa/xóa building không có room, tìm `  TÒA A  ` khớp `Tòa A`, cancel confirm không xóa, refresh giữ kết quả.
- [x] **Step 5 — Commit nếu có diff:** `git commit -m "feat: complete building management"`.

### Task 1.3: Room CRUD, liên kết và filter

**Files:** `src/utils/validateRoom.ts`, `src/components/rooms/RoomForm.tsx`, `src/pages/RoomsPage.tsx`, store; `src/store/rooms.test.ts`.

**Interfaces:** Consumes building actions/types; produces `validateRoom(input: RoomInput, buildings: Building[], rooms: Room[], roomId?: string): string | null`, room actions và `/rooms`.

- [x] **Step 1 — Test `rooms.validateAndPreserveRelations`:** building không tồn tại, floor 0/vượt floors, area <=0/NaN/Infinity, rent <0/lẻ bị từ chối; ` A01 ` và `a01` trùng trong cùng building; số phòng đó ở building khác được; sửa chính nó không bị duplicate; delete room có confirmed/cancelled booking đều bị chặn.
- [x] **Step 2 — Chạy:** `npx vitest run src/store/rooms.test.ts`; xác minh fail đúng nếu thiếu.
- [x] **Step 3 — Hoàn thiện:** valid add/update/delete; building select; filter building + status theo AND; xóa room không có booking với confirm; state giữ nguyên khi validation lỗi.
- [x] **Step 4 — Kiểm chứng:** unit PASS; browser có hai building/tối thiểu ba room, kết hợp filter ra đúng room; refresh còn liên kết đúng.
- [x] **Step 5 — Commit nếu có diff:** `git commit -m "feat: complete room management and filters"`.

### Task 1.4: Booking và quy tắc ngày/trùng lịch

**Files:** `src/utils/validDate.ts`, `src/utils/hasBookingOverlap.ts`, `src/utils/validateBooking.ts`, `src/components/bookings/BookingForm.tsx`, `src/pages/BookingsPage.tsx`, store; `src/utils/hasBookingOverlap.test.ts`, `src/store/bookings.test.ts`.

**Interfaces:** Consumes room/building/store; produces `validDate(value: string): boolean`, `hasBookingOverlap(bookings: Booking[], roomId: string, checkIn: string, checkOut: string, excludeId?: string): boolean`, `validateBooking(input: BookingInput, buildings: Building[], rooms: Room[], bookings: Booking[], bookingId?: string): string | null`; booking actions và `/bookings`.

- [x] **Step 1 — Viết assertions cốt lõi:**

```ts
expect(validDate('2028-02-29')).toBe(true);
expect(validDate('2026-02-29')).toBe(false);
// fixture b1 confirmed, room r1, 2026-10-10 -> 2026-10-15
expect(hasBookingOverlap([b1], 'r1', '2026-10-15', '2026-10-20')).toBe(false);
expect(hasBookingOverlap([b1], 'r1', '2026-10-14', '2026-10-20')).toBe(true);
expect(hasBookingOverlap([b1], 'r2', '2026-10-14', '2026-10-20')).toBe(false);
expect(hasBookingOverlap([b1], 'r1', '2026-10-10', '2026-10-15', b1.id)).toBe(false);
expect(hasBookingOverlap([{...b1, status: 'cancelled'}], 'r1', '2026-10-10', '2026-10-15')).toBe(false);
```

- [x] **Step 2 — Test store:** ngày trả bằng/trước ngày nhận, ngày lịch sai, room mất/maintenance, building inactive, khách/phone trống đều fail không mutation. Sửa lịch A sang trùng B bị từ chối; hủy B rồi tạo lại khoảng đó được; hủy hai lần không tác động A; không sửa cancelled trở lại confirmed.
- [x] **Step 3 — Chạy:** `npx vitest run src/utils/hasBookingOverlap.test.ts src/store/bookings.test.ts`.
- [x] **Step 4 — Hoàn thiện:** dùng date-only hợp lệ, không đổi qua UTC gây lệch ngày; overlap nửa mở và excludeId; UI thông báo nguyên nhân, cancel giữ lịch sử.
- [x] **Step 5 — Kiểm chứng:** tests PASS; browser tạo/hủy/sửa hai lịch cùng phòng và lịch phòng khác; input sai giữ form để sửa; không có lỗi Console.
- [x] **Step 6 — Commit nếu có diff:** `git commit -m "feat: validate booking dates and overlaps"`.

### Task 1.5: Persistence, UX cơ bản và nghiệm thu task 1

**Files:** store/hook, `src/components/layout/Layout.tsx`, `src/components/common/ConfirmDialog.tsx` khi cần, `src/data/createDemoData.ts`; `src/store/persistence.test.ts`, `e2e/estate.spec.ts`, `docs/acceptance/task-1.md`.

**Interfaces:** Consumes 1.1–1.4; produces production UI đã nghiệm thu, báo lỗi storage, export dữ liệu trước reset/migration. Không tạo service CRUD mới.

- [x] **Step 1 — Test `persistence.handlesUnavailableAndCorruptStorage`:** storage.setItem throw QuotaExceededError → memory có thay đổi + storageWarning; raw JSON hỏng hoặc schema thiếu/wrong type → cảnh báo, raw chưa bị overwrite; dữ liệu cũ images absent hydrate thành []; không dùng demo data ghi đè dữ liệu người dùng.
- [x] **Step 2 — Chạy:** `npx vitest run src/store/persistence.test.ts`.
- [x] **Step 3 — Hoàn thiện:** cảnh báo lưu chưa bền vững; cho tải raw export khi hỏng rồi reset có xác nhận; empty/loading/error; label field và focus dialog; trang 404 client. Không dựng design system mới.
- [x] **Step 4 — Browser E2E:** `estate.fullCrudAndReload` thực hiện building → room → booking → overlap bị chặn → sửa → hủy → reload; `estate.confirmKeyboard` Tab/Escape và cancel không xóa; `estate.filtersAndEmpty` tìm/lọc/empty đúng.
- [x] **Step 5 — Kiểm chứng:** `npm run typecheck`, `npm test -- --run`, `npm run build`, `npm run test:e2e`; dùng production preview `npm run preview -- --host 127.0.0.1`, không nghiệm thu bằng dev server. Evidence không chứa thông tin khách thật.
- [x] **Step 6 — Ghi `docs/acceptance/task-1.md`:** checklist theo từng bullet mentor, commit SHA, lệnh/kết quả/browser evidence và gap còn lại. Nếu tất cả đã đạt, đánh dấu task 1 hoàn tất không sửa lại.
- [x] **Step 7 — Commit nếu có diff:** `git commit -m "test: verify estate workflows and persistence"`.
