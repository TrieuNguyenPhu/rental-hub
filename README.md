# Rental Hub

Ứng dụng quản lý tòa nhà, phòng và lịch đặt phòng bằng React, TypeScript, Vite, Zustand và React Router. Các route chính: `/`, `/buildings`, `/rooms`, `/bookings`.

## Chạy local

Yêu cầu Node.js 24 và npm.

```bash
npm ci
npm run dev
```

Vite mặc định chạy tại `http://localhost:5173`. Dữ liệu CRUD được lưu trong `localStorage` của từng trình duyệt; không đồng bộ giữa thiết bị. Muốn tải ảnh khi phát triển local, chạy thêm API media:

```powershell
Copy-Item .env.example .env
npm run dev:media
```

Trong terminal khác, chạy `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` để khớp `SITE_ORIGIN` trong `.env`. File ảnh local nằm trong `.local/media/`, ngoài Git.

## Build và kiểm tra

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`npm run build` tạo frontend tại `.local/build/web/`. E2E cần Chromium; nếu máy chưa có, chạy `npx playwright install chromium` rồi đặt `PLAYWRIGHT_CHANNEL=chromium`. CI còn build và kiểm tra API media cho local/VPS và AWS.

## Triển khai

| Môi trường | Trạng thái và tài liệu |
| --- | --- |
| GCP Compute Engine | [Terraform, deploy lại, rollback và destroy](infra/gcp/README.md). Frontend chạy qua HTTP; upload ảnh bị tắt. |
| AWS S3/CloudFront | [Terraform và quy trình deploy](docs/task3-aws-deployment.md), [CI/CD](docs/deploy/ci-cd.md). Dữ liệu và ảnh dùng S3/API riêng. |
| VPS Linux | [Runbook](docs/deploy/vps.md) và [release/rollback](docs/deploy/releases.md); chưa nghiệm thu trên VPS độc lập. |

Script deploy lại GCP từ repo root:

```powershell
powershell -ExecutionPolicy Bypass -File ops/gcp/deploy.ps1
```

Bản GCP chưa có domain/HTTPS, authentication hoặc lưu dữ liệu chung. Không nhập dữ liệu khách hàng thật hay credentials trên website HTTP. Bản AWS là demo công khai không xác thực; chỉ dùng dữ liệu giả.

## Tài liệu

- [Kiến trúc và ranh giới các môi trường](docs/architecture.md)
- [Quy tắc chức năng và phạm vi ban đầu](docs/task-brief.md)
- [Giải thích cấu trúc React](docs/react-learning.md)
- [API ảnh và dữ liệu AWS](docs/task3-static-images.md)
- [Xử lý sự cố](docs/runbook/troubleshooting.md)
- [Hồ sơ kiểm thử và nghiệm thu](docs/acceptance/)
