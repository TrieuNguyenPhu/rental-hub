# Cấu trúc dự án

`apps/web/src/main.tsx` chọn Zustand store dùng localStorage cho local/GCP/VPS hoặc remote store gọi `/api/estate` cho AWS. Các trang đọc store qua `useEstateStore`. Quy tắc nghiệp vụ nằm trong `domain/`, độc lập với React và các adapter.

| Thư mục/file | Vai trò |
| --- | --- |
| `apps/web/src/pages/` | Bốn màn hình dashboard, tòa nhà, phòng, đặt lịch; giữ state giao diện. |
| `apps/web/src/components/` | Form, dialog, layout và các phần giao diện dùng lại. |
| `apps/web/src/domain/` | Validation, ngày, kiểm tra chồng lịch, CRUD actions và contracts. |
| `apps/web/src/services/` | localStorage, remote AWS store và HTTP upload. |
| `apps/web/src/store.ts` | Zustand state; gọi domain actions và lưu qua persistence. |
| `apps/web/src/AppContext.ts` | Context truyền dependencies và custom Hooks cho UI. |
| `apps/web/src/App.tsx` | Provider và các routes. |
| `apps/web/src/utils/` | Định dạng hiển thị và đọc FormData. |
| `apps/media/src/` | HTTP API Node, xử lý ảnh bằng Sharp và lưu file cho local/VPS. |
| `packages/domain/models.ts` | Kiểu dữ liệu dùng chung giữa web và media. |
| `infra/aws/` | Terraform cho S3, CloudFront, logs và cảnh báo S3. |
| `infra/gcp/`, `ops/gcp/` | VM, mạng, Nginx và release frontend GCP. |
| `apps/aws-media/` | Lambda CRUD dữ liệu chung và xử lý ảnh Sharp. |
| `ops/aws/` | Script build Lambda, deploy/rollback AWS. |
| `ops/deploy/`, `ops/release/` | VPS, Nginx, systemd và quy trình release. |
| `tests/` | Unit, architecture, media, E2E và fixture vận hành. |

`bookingRoomError` là quy tắc chung cho khả năng nhận booking của phòng/tòa nhà. Form, nút tạo lịch và validation khi lưu đều dùng quy tắc này. CRUD actions chỉ nhận hàm đọc state và commit; Zustand giữ state cho React và gọi persistence sau mutation. Persistence giữ khóa `room-finder-estate-v1`, đọc version 0/1 và ghi version 1.

Bản AWS dùng CloudFront + S3 cho frontend/ảnh; `/api/*` tới API Gateway và Lambda. Lambda lưu metadata trong S3 data bucket riêng, có versioning và conditional writes. API chưa có xác thực, vì vậy chỉ dùng dữ liệu giả. Local dùng localStorage và media API; GCP dùng localStorage và tắt upload trên HTTP. Cấu hình VPS hiện là runbook, chưa có môi trường đang vận hành. Xem [AWS](deploy/aws.md), [GCP](../infra/gcp/README.md) và [VPS](deploy/vps.md).

## Terraform state

AWS production và staging dùng state cục bộ riêng; đọc [hướng dẫn AWS](deploy/aws.md) trước khi chạy Terraform trên máy khác. GCP dùng bucket GCS riêng tư có versioning cho state tại prefix `gcp/production`. Không đưa state, plan hoặc credential vào Git.
