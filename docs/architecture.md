# Cấu trúc dự án

`apps/web/src/main.tsx` tạo persistence và Zustand store, chọn HTTP upload ảnh cho local/VPS hoặc tắt upload cho bản AWS tĩnh, rồi truyền các dịch vụ vào `App`. Các trang đọc store qua custom Hook `useEstateStore` và truyền props cho form, dialog, thành phần hiển thị. Quy tắc nghiệp vụ nằm trong `domain/`, độc lập với React và các adapter.

| Thư mục/file | Vai trò |
| --- | --- |
| `apps/web/src/pages/` | Bốn màn hình dashboard, tòa nhà, phòng, đặt lịch; giữ state giao diện. |
| `apps/web/src/components/` | Form, dialog, layout và các phần giao diện dùng lại. |
| `apps/web/src/domain/` | Validation, ngày, kiểm tra chồng lịch, CRUD actions và contracts. |
| `apps/web/src/services/` | localStorage, persistence và HTTP upload. |
| `apps/web/src/store.ts` | Zustand state; gọi domain actions và lưu qua persistence. |
| `apps/web/src/AppContext.ts` | Context truyền dependencies và custom Hooks cho UI. |
| `apps/web/src/App.tsx` | Provider và các routes. |
| `apps/web/src/utils/` | Định dạng hiển thị và đọc FormData. |
| `apps/media/src/` | HTTP API Node, xử lý ảnh bằng Sharp và lưu file cho local/VPS. |
| `packages/domain/models.ts` | Kiểu dữ liệu dùng chung giữa web và media. |
| `infra/aws/` | Terraform cho S3, CloudFront, logs và cảnh báo S3. |
| `ops/aws/` | Script deploy/rollback bản AWS tĩnh. |
| `ops/deploy/`, `ops/release/` | VPS, Nginx, systemd và quy trình release. |
| `tests/` | Unit, architecture, media, E2E và fixture vận hành. |

`bookingRoomError` là quy tắc chung cho khả năng nhận booking của phòng/tòa nhà. Form, nút tạo lịch và validation khi lưu đều dùng quy tắc này. CRUD actions chỉ nhận hàm đọc state và commit; Zustand giữ state cho React và gọi persistence sau mutation. Persistence giữ khóa `room-finder-estate-v1`, đọc version 0/1 và ghi version 1.

Bản AWS không có backend hay xác thực: CRUD ở localStorage riêng mỗi trình duyệt; giao diện đọc ảnh đã có nhưng tắt upload mới. Local/VPS vẫn dùng media API. Xem [giải thích React](react-learning.md) và [triển khai AWS](task3-aws-deployment.md).

## Terraform state

Root module `infra/aws` gồm `storage`, `cdn`, `logging` và alarm tại `monitoring.tf`. CloudFront log delivery dùng `us-east-1`, policy bucket logs dùng provider Sydney. State local được phục hồi bằng import ngày 15/10/2026; bucket và distribution cũ được giữ nguyên. State/backup không đưa lên Git. Xem hướng dẫn AWS trước khi plan trên máy khác.
