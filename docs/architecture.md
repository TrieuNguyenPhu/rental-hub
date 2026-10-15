# Cấu trúc và ranh giới phụ thuộc

`apps/web/src/main.tsx` nối các adapter cụ thể với ứng dụng. `apps/media/src/main.ts` nối HTTP server với storage media. Hai entry point này là nơi chọn implementation; các lớp bên trong không tự khởi tạo AWS client, localStorage hoặc filesystem adapter.

```text
apps/
  web/
    src/
      components/       # Forms, dialogs, layout
      domain/           # Booking rules, validation, dates, actions
      pages/            # React screens
      services/         # localStorage, Cognito/S3, HTTP upload
      utils/            # Display formatting and form parsing
      App.tsx            # Routing
      AppContext.ts      # UI dependency context
      store.ts           # Zustand state/actions
      main.tsx           # Composition root
    public/fonts/        # Fonts and OFL license
  media/src/             # HTTP API, image processing, filesystem, entry point
packages/domain/models.ts # Shared data types
infra/aws/               # Terraform root, state migration and AWS modules
ops/
  aws/                   # AWS deployment and admin setup
  deploy/                # VPS environment, Nginx and systemd templates
  release/               # Build, deploy, rollback and smoke checks
tests/
  unit/                  # Unit tests
  architecture/          # Dependency and Terraform migration checks
  media/                 # Media server tests
  e2e/                   # Playwright
  operations/            # Operations script fixtures
```

Mã web hiện gom các quy tắc và actions vào `domain/`, các adapter bên ngoài vào `services/`, giao diện vào `components/`/`pages/`, state trong `store.ts`. `main.tsx` khởi tạo adapter rồi truyền dependency cho app. Media API tách thành các module nhỏ theo chức năng trong `apps/media/src`; `packages/domain/models.ts` là kiểu dùng chung. Test kiến trúc kiểm tra import giữa các nhóm này tại `tests/architecture/architecture.test.ts`.

`bookingRoomError` trong domain là nguồn quy tắc duy nhất cho điều kiện phòng/tòa nhà được nhận booking. Nút tạo lịch, lựa chọn phòng trong form và validation khi lưu đều dùng quy tắc này. Phòng `occupied` vẫn nhận lịch nếu ngày không trùng; phòng bảo trì hoặc tòa nhà không hoạt động thì không.

`apps/web/src/main.tsx` đọc các biến `VITE_AWS_*` rồi gọi `createAwsAdmin(config)`. Adapter trả về hai port `admin` và `uploadImage`; mỗi instance giữ phiên Cognito riêng, không đọc môi trường Vite hoặc tạo client khi import module. `apps/media/src/main.ts` chuyển `NODE_ENV` thành `MediaConfig.development`; HTTP server nhận cấu hình này thay vì đọc môi trường toàn cục. Development vẫn phục vụ ảnh local, production vẫn để Nginx phục vụ ảnh.

Kiểm chứng bổ sung ngày 2026-10-14: `npm test` đạt 55 test, bỏ qua 1 test quyền file dành cho Linux; `npm run test:e2e -- --workers=2` chạy local trên Chrome đạt 16 test, bỏ qua 1 test AWS thật. `npm run build`, `npm run build:media`, typecheck và lint đều đạt. Các test mới kiểm tra ma trận trạng thái phòng/tòa nhà, cấu hình AWS, phiên Cognito độc lập và upload qua SDK giả lập; không xác nhận kết nối Cognito/S3 thật. Build còn cảnh báo bundle JavaScript lớn hơn 500 kB.

CRUD actions nhận hàm đọc state và commit thay đổi; không biết Zustand hay cách lưu dữ liệu. Zustand giữ state cho React và gọi persistence sau mutation. Persistence giữ nguyên khóa `room-finder-estate-v1`, đọc version 0/1 và chỉ ghi version 1. Dữ liệu hỏng vẫn được giữ nguyên cho đến khi xuất rồi xác nhận khôi phục demo. Auth và upload được truyền qua context để giao diện dùng cùng contract ở local và AWS.

API media giữ origin validation, giới hạn body, timeout, một upload tại một thời điểm, OS lock và publish nguyên cặp ảnh. Production vẫn chạy `server-dist/server/main.js`; Nginx/systemd và release scripts giữ nguyên contract này.

## Terraform và state hiện có

Root module vẫn ở `infra/aws`, dùng state và lock file hiện có. Bốn module dùng cùng tên tài nguyên và cấu hình; 21 `moved` block ánh xạ tài nguyên từ root vào module. Đây là cơ chế [refactor module của Terraform](https://developer.hashicorp.com/terraform/language/modules/develop/refactoring). Giữ các block này để state cũ và state chưa được nâng cấp vẫn có đường migration.

```powershell
terraform '-chdir=infra/aws' init
terraform '-chdir=infra/aws' fmt -check -recursive
terraform '-chdir=infra/aws' validate
terraform '-chdir=infra/aws' test
terraform '-chdir=infra/aws' plan
```

Kiểm tra plan trước khi apply: việc đổi cấu trúc chỉ được đổi địa chỉ, không được tạo lại hoặc xóa tài nguyên. Các thay đổi nghiệp vụ/hạ tầng khác đang có trong working tree cần được xem riêng. Không chạy `state rm`, không tạo state mới và không xóa state/backup để xử lý việc đổi thư mục.

Kiểm tra refactor ngày 2026-10-14: cấu hình của cả 21 resource block được đối chiếu với bản trước khi tách; state và backup local không thay đổi. Plan offline trên bản sao state, với provider không gọi mạng, ghi nhận 25 resource instances chuyển địa chỉ, không có create/update/destroy và không đổi outputs. Plan dùng AWS provider thật chưa hoàn thành do DNS STS trên máy; kiểm tra lại plan live trước khi apply. Test Terraform dùng mock provider và không chạm tài nguyên thật.

`infra/ec2` đã được bỏ khỏi source theo yêu cầu. Đây không phải thao tác xóa tài nguyên trên AWS. Hồ sơ Task 2 trong `docs/acceptance/task-2.md` giữ thông tin demo cũ để truy vết; quy trình VPS/Nginx còn trong `ops/deploy/`, `ops/release/` và `docs/deploy/`.
