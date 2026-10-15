# EstateFlow — Real Estate Management MVP

Giải thích các khái niệm React, Hooks và cấu trúc mã nguồn: [React trong bài EstateFlow](docs/react-learning.md).

Ứng dụng quản lý bất động sản phục vụ bài thực tập DevOps. React + TypeScript + Vite, Zustand, React Router, Lucide React và CSS thuần. Local/VPS lưu CRUD trong trình duyệt và upload ảnh qua API Node/Sharp. Bản AWS dùng S3/CloudFront, API Gateway và Lambda để lưu dữ liệu chung và tải ảnh WebP lên S3. Font được lưu trong `apps/web/public/fonts/`.

## Cài đặt và chạy local

Khuyến nghị Node.js 24 và npm. Môi trường kiểm tra thực tế: Node.js 24.18.0.

```bash
npm ci
npm run dev
```

Mở URL do Vite in ra, mặc định `http://localhost:5173`. Để cố định URL:

```bash
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

## Production build

Task 2/4/5: xem [VPS độc lập](docs/deploy/vps.md), [deploy/rollback](docs/deploy/releases.md), [runbook sự cố](docs/runbook/troubleshooting.md) và [nghiệm thu](docs/acceptance/demo.md). AWS Task 3 dùng thêm API để hỗ trợ ảnh và dữ liệu chung. Các template/script VPS đã chuẩn bị; chưa có VPS public để nghiệm thu thực tế.

```bash
npm run build
npm run preview
```

Build chạy TypeScript validation trước khi tạo bản web tại `.local/build/web/` (thư mục sinh tự động, bị Git bỏ qua). Preview phục vụ bản build tại URL Vite in ra, mặc định `http://localhost:4173`.

Ứng dụng dùng BrowserRouter. Khi phục vụ trên static hosting sau này, cần fallback các route về `index.html` để refresh `/buildings`, `/rooms`, `/bookings` hoạt động. Không cấu hình Nginx, VPS, AWS, Docker hoặc CI/CD trong Task 1.

## Chức năng

- `/`: dashboard thống kê từ state thực tế, lịch đặt còn hiệu lực và danh mục tòa nhà.
- `/buildings`: thêm, sửa, xóa, tìm tên không phân biệt hoa/thường, badge trạng thái. Không xóa tòa nhà có phòng; không giảm số tầng dưới tầng của phòng hiện có.
- `/rooms`: thêm, sửa, xóa, tìm số phòng, kết hợp bộ lọc tòa nhà và trạng thái; giá thuê VND nguyên không âm. Kiểm tra tòa nhà tồn tại, số phòng duy nhất trong tòa nhà, tầng hợp lệ và diện tích dương. Có trạng thái khả dụng, đang sử dụng và bảo trì.
- `/bookings`: tạo, sửa, hủy, tìm khách hàng/số điện thoại và lọc trạng thái. Hủy có xác nhận, giữ lịch sử và khóa chỉnh sửa. Không có thao tác xóa vĩnh viễn hoặc kích hoạt lại booking, theo yêu cầu module.
- Route khác hiển thị trang 404.
- Modal có quản lý focus, hỗ trợ Escape; thông báo thành công/lỗi và layout responsive với bảng cuộn ngang trên màn hình nhỏ.
- Khôi phục 3 tòa nhà, 12 phòng và 7 booking demo bằng nút có xác nhận ở sidebar.

Validation và CRUD nằm trong `apps/web/src/domain`; Zustand giữ state cho giao diện và gọi các actions này. Actions trả về `{ ok: true, id }` hoặc `{ ok: false, error }`; cập nhật bất biến và ID dùng `crypto.randomUUID()`.

### Quy tắc booking

Helper `apps/web/src/domain/bookingOverlap.ts` áp dụng:

```text
newCheckIn < existingCheckOut && newCheckOut > existingCheckIn
```

Chỉ xét booking `confirmed` của cùng phòng; bỏ qua ID đang sửa. Hai lịch liền ngày được phép. Lịch đã hủy không chặn ngày. Mọi lần tạo/sửa đều kiểm tra phòng và tòa nhà: phòng không được bảo trì, tòa nhà phải đang hoạt động. Thay trạng thái phòng/tòa nhà không tự hủy lịch đã có; vẫn có thể hủy lịch đó.

Dashboard đếm “phòng khả dụng” theo `room.status === 'available'`, không tự đổi trạng thái phòng vì có booking. “Lịch đặt còn hiệu lực” là booking đã xác nhận có `checkOut` sau ngày hiện tại của trình duyệt, bao gồm lịch sắp tới.

## Cấu trúc

```text
apps/
  web/                  # React + Vite: src/, public/, index.html
  media/                # Node HTTP API for image processing and storage
packages/
  domain/models.ts      # Shared data types
infra/aws/              # Terraform root module and AWS modules
ops/
  aws/                  # AWS deployment and rollback
  deploy/               # VPS, Nginx and systemd templates
  release/              # VPS build, deploy, rollback and smoke checks
tests/
  unit/                 # Node unit tests
  architecture/         # Dependency and Terraform migration checks
  media/                # Media API and image tests
  e2e/                  # Playwright
  operations/           # Operations script fixtures
docs/                   # Guides, runbooks and acceptance evidence
.local/                 # Generated builds, media and test output; gitignored
```

Trong `apps/web/src`, `domain/` chứa quy tắc và actions nghiệp vụ, `services/` chứa adapter lưu trữ/AWS/upload, `components/` và `pages/` là giao diện, còn `store.ts` nối state giao diện với actions. Media server có entry point và các module xử lý ảnh riêng trong `apps/media/src`.


## Lưu dữ liệu

- Khóa localStorage: `room-finder-estate-v1`.
- Lưu seed ngay lần đầu mở. Những lần sau khôi phục dữ liệu đã lưu, kể cả các danh sách rỗng; không seed lại sau reload.
- Dữ liệu riêng cho từng browser profile và origin (giao thức + host + port). `localhost:5173`, `127.0.0.1:5173` và `localhost:4173` có bộ dữ liệu riêng.
- Xóa dữ liệu trình duyệt sẽ xóa dữ liệu ứng dụng. Không có đồng bộ giữa thiết bị, sao lưu máy chủ hoặc quản lý người dùng trong MVP.
- Khi localStorage bị chặn hoặc đầy, giữ thay đổi trong bộ nhớ và hiện cảnh báo sẽ mất khi tải lại; không hiện thông báo đã lưu. Khi dữ liệu hỏng, giữ nguyên bản gốc và chặn ghi đè cho đến khi xuất dữ liệu rồi xác nhận khôi phục demo.
- Nút khôi phục tải bản backup trước khi mở xác nhận. Version 0 được đọc tương thích; version 1 được ghi ở mutation tiếp theo; ảnh thiếu được chuẩn hóa thành `[]` trong bộ nhớ.
- Dữ liệu booking chứa thông tin khách hàng nên chỉ dùng dữ liệu demo cho bài thực tập. localStorage không được mã hóa.

## Kiểm thử tự động

```bash
npm test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
npm run build:media
```

`npm test` dùng Node test runner, không cần backend hoặc browser. `npm run typecheck` kiểm tra cả source, cấu hình Playwright và mã kiểm thử.

E2E dùng Playwright với Google Chrome đã cài. Tự khởi động Vite hoặc dùng server đang chạy ở `127.0.0.1:5173`; mỗi test dùng browser context riêng, không thay đổi dữ liệu cá nhân.

Nếu máy chưa có Chrome:

```bash
npx playwright install chromium
```

Sau đó chạy E2E với biến môi trường `PLAYWRIGHT_CHANNEL=chromium`:

```powershell
# PowerShell
$env:PLAYWRIGHT_CHANNEL = 'chromium'
npm run test:e2e
```

```bash
# macOS/Linux
PLAYWRIGHT_CHANNEL=chromium npm run test:e2e
```

## Kiểm thử thủ công

1. **Tòa nhà:** tạo tòa nhà mới, sửa tên rồi tìm bằng tên viết thường. Xóa tòa nhà chưa có phòng: thử “Quay lại”, sau đó xác nhận xóa. Thử tên trống/số tầng 0 hoặc 1.5. Thử xóa Riverside Residence: phải bị chặn vì có phòng.
2. **Phòng:** tạo phòng trong tòa nhà mới; thử số phòng trùng trong cùng tòa nhà, tầng vượt giới hạn, diện tích 0 hoặc giá thuê lẻ/âm. Giá thuê 0 được phép. Sửa phòng, kết hợp bộ lọc tòa nhà và trạng thái; thử xóa phòng chưa có booking. Xóa phòng có booking đã hủy cũng phải bị chặn.
3. **Booking:** dùng một phòng khả dụng mới, tạo lịch `2027-03-01 → 2027-03-10`. Tạo lịch `2027-03-05 → 2027-03-12` cùng phòng: phải báo trùng. Tạo lịch `2027-03-10 → 2027-03-15`: phải được chấp nhận. Sửa tên khách của lịch đầu mà giữ ngày: phải được chấp nhận.
4. **Đổi phòng:** tạo lịch giao nhau ở phòng B; chuyển lịch từ phòng A vào B: phải bị chặn. Thử trả phòng bằng/trước ngày nhận hoặc để trống khách hàng: phải báo lỗi. Phòng bảo trì bị vô hiệu hóa trong danh sách chọn.
5. **Hủy:** hủy lịch đầu sau xác nhận; vẫn thấy “Đã hủy” và nút sửa/hủy bị khóa. Tạo lịch mới đúng ngày của lịch đã hủy: phải được phép nếu không giao với lịch confirmed khác.
6. **Persist/dashboard:** tạo/sửa dữ liệu, reload trực tiếp từng route và đối chiếu dữ liệu cùng thống kê. Thử “Khôi phục dữ liệu demo”, chọn “Quay lại”: dữ liệu phải giữ nguyên.
7. **Mobile/keyboard:** thử màn hình 320px, mở sidebar, chuyển trang; bảng cuộn trong vùng bảng. Tab qua form, Escape đóng modal và trả focus về nút mở.

## Tài liệu tham khảo

Triển khai AWS Task 3 bằng Terraform: [cấu hình, deploy lại, log và rollback](docs/task3-aws-deployment.md), [ảnh và dữ liệu chung](docs/task3-static-images.md). Website: https://d2pqq5rtvfmo3w.cloudfront.net.

- [Vite](https://vite.dev/guide/)
- [Zustand persist](https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data)
- [React Router](https://reactrouter.com/start/declarative/installation)

## Ảnh building/room

Copy `.env.example` sang `.env`, chạy `npm run dev:media` trong một terminal và `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` trong terminal khác. Origin phải đúng `http://127.0.0.1:5173`; nếu dùng host/port khác, đổi `SITE_ORIGIN` tương ứng. Production preview local dùng `npm run build` rồi `npm run preview -- --host 127.0.0.1 --port 5173 --strictPort` cùng service media.

Lưu tòa nhà/phòng trước, mở chỉnh sửa rồi chọn ảnh. JPEG/PNG/WebP tĩnh, tối đa 10 MiB local/VPS hoặc 4 MiB AWS, 20 MP, rộng sau EXIF từ 1200px. Server tạo WebP chất lượng 80, rộng 600/1200, giữ tỷ lệ và loại metadata. Ảnh được liên kết ngay sau upload; nút Đóng form không hoàn tác ảnh đã liên kết. UI tối đa 5 ảnh/entity; bỏ ảnh chỉ gỡ liên kết, không xóa file. Bản AWS chia sẻ cả ảnh và dữ liệu với mọi người truy cập; chỉ nhập dữ liệu giả.

Dev lưu files trong `.local/media/` (ngoài Git), Vite proxy `/api` và `/images` tới `127.0.0.1:3001`. `npm run build:media` tạo `.local/build/media/apps/media/src/main.js` (release đóng gói entry thành `server-dist/server/main.js`); `npm run start:media` chạy entry production với environment do service cung cấp. Production bắt buộc roots tuyệt đối tồn tại, cùng filesystem, ngoài release; `SITE_ORIGIN` HTTPS, `release.json` có full SHA ở release chứa `server-dist/`. Default mode là production. Media bind loopback; Nginx phải cung cấp HTTPS + Basic Auth cho upload, body/rate limits và static `/images/`. Không đưa secrets vào `VITE_*` hoặc Git. Candidate dùng `MEDIA_READ_ONLY=true`, không upload hoặc dọn temp production.

API nhận raw file `POST /api/images?entityType=building|room&entityId=<id>`, Origin đúng SITE_ORIGIN. `GET /api/health` kiểm tra quyền ghi và trả releaseId. Một ảnh xử lý tại một thời điểm (429 khi bận); deadline body 30 giây. File ảnh cần backup riêng; không có garbage collection.

Evidence: [Task1](docs/acceptance/task-1.md), [ảnh và compression](docs/acceptance/images.md). `npm run test:e2e` tự chạy production preview và media local; chạy `npm run build` trước. Có thể dùng `PLAYWRIGHT_BASE_URL` để kiểm tra origin đã triển khai; tests ảnh sẽ upload fixture tới origin đó.

Giới hạn codec: bản WebP 1200px phải cao tối đa16383px; ảnh cực dọc vượt giới hạn này nhận 422. APNG nhiều frame bị từ chối. Đóng form/chuyển trang hủy upload đang chờ; ảnh đã liên kết vẫn giữ, còn file server đã tạo nhưng chưa liên kết có thể tồn tại. Writable media dùng OS lock theo tempRoot trên Linux/Windows, giữ lock đến khi xử lý đang chạy kết thúc, kể cả client ngắt kết nối. Các OS khác chưa hỗ trợ writable media.
