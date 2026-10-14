# Rental Hub — Task 1–5 và ảnh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thành và chứng minh toàn bộ bài mentor, gồm CRUD, ảnh, VPS, AWS, update, rollback và xử lý sự cố.

**Architecture:** React/TypeScript/Zustand lưu metadata theo browser. API ảnh Node/Sharp tạo WebP; Nginx phục vụ frontend và ảnh; VPS và AWS vận hành độc lập. Release theo commit SHA, shared images/assets ngoài release.

**Tech Stack:** React, TypeScript, Zustand, Vite, React Router, Node.js 24 LTS, Sharp, Nginx, Ubuntu 24.04 LTS, EC2/EBS, Git, Bash; Vitest và Playwright cho phần cần kiểm thử.

**Spec:** [Thiết kế đề xuất](../specs/2026-10-13-rental-hub-design.md).

## Global Constraints

- Trạng thái cập nhật 2026-10-14: người dùng yêu cầu hoàn tất các task còn lại, chi phí 0đ. Task 1/Images đã nghiệm thu; Task 3 đã xong trước kế hoạch và không thực thi lại. VPS/AWS độc lập. Xem `docs/acceptance/operations-execution.md`; triển khai VPS public chờ tài khoản/SSH thực tế.
- Task 1 và task 3 đã hoàn thành theo người dùng; nghiệm thu trước, chỉ bổ sung phần thiếu, không viết lại mặc định.
- Không khảo sát code để lập thiết kế; mọi đường dẫn/API frontend là mục tiêu cần đối chiếu khi thực thi. Không invent line number hoặc tuyên bố test đã chạy.
- React, TypeScript, Zustand, Git, Linux, VPS và AWS là yêu cầu bắt buộc. Baseline mới: Ubuntu 24.04 LTS, Node.js 24 LTS, Nginx, EC2/EBS.
- Ảnh WebP width 600/1200, giữ tỷ lệ, quality 80; input tối đa 10 MiB, 20.000.000 pixel, width sau EXIF >=1200; UI tối đa 5 ảnh/entity.
- Dữ liệu CRUD localStorage theo browser/origin; ảnh ngoài release. Không đồng bộ metadata/ảnh giữa môi trường.
- Build/candidate fail không đổi current. Không ghi secret/ảnh upload vào Git hoặc frontend env.
- Upload qua Internet chỉ khi có HTTPS tin cậy + Basic Auth; service bind loopback; frontend HTTP vẫn có thể demo nếu chưa có domain.
- Không thêm Docker, database, login sản phẩm, Kubernetes, CI/CD hoặc chuyển AWS nếu nhu cầu chưa chứng minh.

## Review Focus

1. Booking sát biên ngày, chỉnh lịch hiện tại và lịch hủy: tests App 1.4.
2. Xóa dữ liệu có quan hệ và storage hỏng/hết quota: tests App 1.2, 1.3, 1.5.
3. Ảnh giả MIME, EXIF, ảnh động/quá lớn và ghi file thứ hai lỗi: tests Media I.1–I.2.
4. Build fail, activation fail, rollback thiếu release và concurrent deploy: tests Operations 4.1–4.3.
5. Tab cũ giữ asset cũ, route refresh và ảnh 404 không thành HTML 200: tests Deployment 2.2, Operations 4.2 và 5.1.

## Các kế hoạch thực thi chi tiết

| Mentor | Kế hoạch | Deliverable |
|---|---|---|
| Task 1 | [Website — 1.1 đến 1.5](2026-10-13-rental-hub-app.md) | Types/state, building, room, booking, persistence và nghiệm thu browser |
| Phần ảnh bổ sung | [Ảnh — I.1 đến I.3](2026-10-13-rental-hub-images.md) | Resize/WebP, API và UI building/room |
| Task 2 | [Deploy — 2.1 đến 2.3](2026-10-13-rental-hub-deployment.md) | VPS truy cập ngoài, Nginx/routing, media, HTTPS và log |
| Task 3 | [Deploy — 3.1 đến 3.2](2026-10-13-rental-hub-deployment.md) | AWS độc lập, quyền/network, routing, ảnh, log |
| Task 4 | [Operations — 4.1 đến 4.3](2026-10-13-rental-hub-operations.md) | Build/deploy có thể lặp lại, cập nhật và rollback cả hai |
| Task 5 | [Operations — 5.1 đến 5.3](2026-10-13-rental-hub-operations.md) | E2E, runbook, fault drills và demo cuối |

Đây là 19 task nhỏ: 5 website, 3 ảnh, 5 triển khai và 6 vận hành. Mỗi task có output, interface, bước kiểm thử và commit riêng. Các lệnh trong tài liệu là lệnh dự kiến để chạy khi triển khai, không phải kết quả đã thực hiện.

## Trình tự và phụ thuộc

1. **App 1.1 → 1.2 → 1.3 → 1.4 → 1.5:** chạy kiểm tra phần đã có. Task được đánh dấu hoàn tất khi có evidence; không cần code mới nếu đã đạt.
2. **Media I.1 → I.2 → I.3:** dùng ID entity ổn định và state đã có; tích hợp sau khi CRUD đạt.
3. **Deployment 2.1 → 2.2 → 2.3:** dựng VPS và deploy bản đầu; không đợi CI.
4. **Deployment 3.1 → 3.2:** kiểm tra AWS đã có, tích hợp ảnh phù hợp kiến trúc được xác nhận. Có thể chuẩn bị AWS sau 2.2, nhưng không tự đổi kiến trúc đã chạy.
5. **Operations 4.1 → 4.2 → 4.3:** chuẩn hóa script rồi diễn tập A → B → A cả hai môi trường.
6. **Operations 5.1 → 5.2 → 5.3:** browser/public checks, xử lý sự cố và bộ evidence demo.

## Quy tắc đối chiếu phần đã làm

- [ ] Trước thực thi, xác nhận spec §2: upload server, ý nghĩa 600/1200, limit ảnh, hai ID URL, AWS hiện tại và HTTPS.
- [ ] Khi được phép đọc code, kiểm tra `.codegraph/` ở repo root. Nếu có, dùng CodeGraph trước khi tìm/đọc code theo AGENTS.md; nếu không có, bỏ qua indexing.
- [ ] Đối chiếu component/type/helper/store với file mục tiêu; ghi mapping vào tài liệu này trước sửa. Dùng implementation tương đương đã có, không đổi tên API chỉ để khớp kế hoạch.
- [ ] Xem package manager, scripts và test runner hiện có. Giữ công cụ đã có; chỉ bổ sung test runner thiếu cho test thật sự cần.
- [ ] Với task 1/3 đã đạt, lưu evidence và đánh dấu checklist, không tạo commit giả hoặc rebuild hạ tầng.
- [ ] Với AWS S3/CloudFront, dừng phần 3.1 trước mutation để viết điều chỉnh API/storage/IAM/deploy/rollback; phần App/Media/VPS vẫn tiếp tục theo kế hoạch được duyệt.

## Đầu ra để nộp mentor

- Git repository cùng commit SHA ứng với bản demo, source, lockfile, scripts, config templates và runbook.
- Hai URL truy cập bên ngoài, ảnh WebP 600/1200 cho building và room ở mỗi môi trường.
- Evidence CRUD, dates/overlap, deep-link refresh, status/log, HTTPS nếu có.
- Evidence A → B → A, build/candidate fail giữ A, activation fail phục hồi A; checksum ảnh không đổi.
- Bảng xử lý sự cố: triệu chứng, lệnh chẩn đoán, nguyên nhân, khắc phục và xác minh.
- Ghi rõ giới hạn localStorage, ảnh public, upload cần HTTPS, ảnh bỏ liên kết chưa tự xóa, gián đoạn ngắn API khi restart và chi phí AWS.

## Tự review kế hoạch

- Yêu cầu task 1 → App 1.1–1.5; ảnh → I.1–I.3; task 2 → 2.1–2.3; task 3 → 3.1–3.2; task 4 → 4.1–4.3; task 5 → 5.1–5.3.
- API ảnh và releaseId nhất quán giữa bốn kế hoạch. Basic Auth ở Nginx, Origin validation ở API; không nhúng mật khẩu vào frontend.
- Test cần Nginx/SSH/AWS ghi là integration/manual, không thay bằng unit test giả. Task 1/3 chưa được kiểm chứng ở bước lập kế hoạch này.
- Rollback riêng code/runtime, không khẳng định rollback dữ liệu browser; assets và ảnh giữ ngoài release.
- Lựa chọn thực thi chưa được yêu cầu. Khuyến nghị thực thi trực tiếp từng task, review cuối; không dispatch agent hay deploy từ bước lập kế hoạch.

## Execution mapping (2026-10-13, App + Images)
Execution of App/Images is authorized by the user's executing-plans request. Deployment/Operations are not part of this execution.
Existing equivalents retained: `src/store/estateStore.ts` also exports the hook; `src/utils/validation.ts` contains all validators/date helper; `src/utils/bookingOverlap.ts` contains overlap; `src/data/demo.ts` contains the seed; `src/components/common/PageParts.tsx` contains common page parts. Existing `roomNumber`/`rentalPrice` names and building `maintenance` status remain compatible. Unit tests use `node:test` in `tests/`, browser tests use `tests/e2e/`; no Vitest dependency is needed.
Media execution mapping: build:media emits server-dist/server/main.js (rootDir includes shared src/types); start:media and the future Deployment ExecStart contract use that actual path. App/Images steps are complete; Deployment/Operations have not been executed.
