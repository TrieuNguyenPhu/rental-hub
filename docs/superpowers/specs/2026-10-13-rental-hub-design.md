# Thiết kế đề xuất — Rental Hub: task 1–5 và ảnh

Ngày: 2026-10-13. Trạng thái: bản đề xuất để lập kế hoạch, chưa phải thiết kế đã được người dùng duyệt để triển khai.

## 1. Mục tiêu và cách sử dụng tài liệu

Xây dựng ứng dụng quản lý tòa nhà, phòng, lịch đặt bằng React, TypeScript và Zustand; triển khai độc lập trên VPS Linux và AWS; cập nhật, rollback và chẩn đoán sự cố được. Bổ sung ảnh của building/room với hai biến thể WebP 600 và 1200.

Người dùng báo đã hoàn thành task 1 và task 3. Kế hoạch vẫn bao phủ cả năm task của mentor. Với phần đã làm, chạy tiêu chí nghiệm thu trước, chỉ bổ sung chỗ thiếu; không mặc định viết lại hoặc chuyển kiến trúc AWS.

Theo yêu cầu người dùng, không khảo sát code hiện tại để chọn giải pháp. Các đường dẫn source trong kế hoạch là bản đồ mục tiêu, dựa trên danh mục component đã được cung cấp; chưa khẳng định file hay API hiện có đúng như vậy. Trước khi thực thi phải đối chiếu và cập nhật tên file/API, giữ hành vi tương đương đã có.

## 2. Yêu cầu gốc và giả định đề xuất

### Mentor yêu cầu

- Task 1: CRUD building/room; tìm kiếm/lọc; thêm, sửa, hủy booking; kiểm tra ngày và trùng lịch; TypeScript, Zustand; có thể dùng localStorage.
- Task 2: VPS, SSH, môi trường, source, build production, web server, firewall, truy cập ngoài, refresh route con, domain/HTTPS khi có domain, log và xử lý lỗi.
- Task 3: AWS độc lập với VPS; dịch vụ, quyền, production build, network, frontend routing, domain/HTTPS khi có điều kiện, log và chẩn đoán.
- Task 4: Git, cập nhật cả hai môi trường, build/deploy lặp lại, rollback; ưu tiên script/CI; build thất bại không thay bản đang chạy.
- Task 5: xử lý không truy cập được, 403/404/502, frontend sai dù build thành công, refresh route, port/firewall, domain/HTTPS và rollback.
- Bổ sung: ảnh ở room và building; resize, giảm dung lượng, chuyển WebP; có loại 600/1200 và URL tương tự ví dụ mentor.

### Giả định cần xác nhận trước thực thi

1. Người dùng chọn ảnh trong form building/room và upload lên server, không chỉ đóng gói ảnh mẫu lúc build.
2. 600 và 1200 là **chiều rộng pixel**, giữ tỷ lệ, không crop. Ảnh sau sửa EXIF phải rộng ít nhất 1200px; ảnh nhỏ hơn bị từ chối để tránh phóng lớn và gắn nhãn sai.
3. Một building/room có tối đa 5 ảnh trên giao diện; ảnh là tùy chọn. JPEG, PNG, WebP tĩnh được nhận; mỗi file tối đa 10 MiB và 20.000.000 pixel.
4. Đây là demo một người quản trị. Dữ liệu CRUD được lưu riêng theo browser/origin qua localStorage; ảnh được lưu trên server, nhưng bản ghi và liên kết ảnh không đồng bộ giữa thiết bị hay giữa VPS/AWS.
5. Baseline triển khai mới dùng Ubuntu 24.04 LTS, Node.js 24 LTS, Nginx; AWS dùng EC2 với EBS. Cấu hình đã chạy trên AWS được giữ nếu có thể đáp ứng; nếu đang dùng S3/CloudFront, phải xác nhận cách bổ sung dịch vụ ảnh trước task 3.
6. Upload công khai yêu cầu HTTPS tin cậy và xác thực. Nếu chưa có HTTPS, vẫn demo frontend qua HTTP theo đề gốc; kiểm thử upload qua localhost/SSH tunnel, không gửi mật khẩu upload qua HTTP Internet. Demo đầy đủ upload từ Internet chỉ nghiệm thu khi có HTTPS.
7. Hai ID `2519/5636` trong ví dụ chưa có ý nghĩa được mentor xác định. Đề xuất dùng `entityId/imageId`; ID chuỗi cũng được chấp nhận, không ép dữ liệu sang số.

## 3. Các phương án và lựa chọn đề xuất

| Phương án | Ưu điểm | Giới hạn |
|---|---|---|
| React + xử lý browser + IndexedDB | Hạ tầng nhỏ nhất | Không tạo URL ảnh server dùng chung như ví dụ; mất dữ liệu khi xóa browser storage |
| React + API ảnh Node/Sharp + Nginx trên VPS và EC2 | Resize và lưu ảnh thật; cùng quy trình deploy/rollback; dễ demo 502 và log | Cần vận hành thêm process, backup disk; EC2 có chi phí |
| React trên S3/CloudFront + API xử lý ảnh + lưu S3 | Phù hợp frontend tĩnh và CDN | Cần thêm upload auth, quyền IAM, API và xử lý ảnh; nhiều phần cấu hình hơn cho bài tập |

Đề xuất phương án thứ hai cho một thiết kế từ đầu: không có database hay API CRUD vì mentor cho phép localStorage; chỉ thêm API cho nhu cầu ảnh mà frontend tĩnh không tự đáp ứng. Phương án thứ ba chỉ dùng khi kiến trúc AWS đã hoàn thành cần được giữ; khi đó lập phần điều chỉnh AWS riêng trước thực thi, không đổi EC2 âm thầm.

## 4. Task 1 — dữ liệu và hành vi

### Kiểu dữ liệu mục tiêu

- `Building`: `id`, `name`, `address`, `city`, `floors`, `status`, `images`.
- `Room`: `id`, `buildingId`, `number`, `floor`, `area`, `rent`, `status`, `images`.
- `Booking`: `id`, `roomId`, `customerName`, `customerPhone`, `checkIn`, `checkOut`, `status`.
- ID là chuỗi. Ngày là chuỗi `YYYY-MM-DD`, kiểm tra ngày lịch hợp lệ trước so sánh. Tiền VND là số nguyên không âm.
- Building status: `active | inactive`; room: `available | occupied | maintenance`; booking: `confirmed | cancelled`.
- Input thêm không có `id`; ID do store tạo. Booking mới luôn `confirmed`; hủy đổi trạng thái, không xóa lịch sử.

### Quy tắc

- Building: tên/địa chỉ/thành phố không rỗng sau trim; số tầng nguyên từ 1 trở lên. Tìm tên không phân biệt hoa thường, bỏ khoảng trắng đầu/cuối.
- Room: building tồn tại; số phòng không rỗng và không trùng trong cùng building sau trim, không phân biệt hoa thường; tầng nguyên từ 1 đến `building.floors`; diện tích hữu hạn > 0; giá thuê nguyên >= 0. Lọc building và trạng thái kết hợp bằng AND.
- Không giảm số tầng xuống dưới tầng cao nhất có phòng. Không xóa building còn phòng, không xóa room có bất kỳ lịch sử booking nào. Thông báo nguyên nhân để người dùng xử lý, không cascade xóa dữ liệu.
- Booking: tên khách không rỗng; điện thoại là chuỗi không rỗng sau trim, không đặt regex theo nhà mạng; room tồn tại, không `maintenance`, building phải `active`.
- Lịch dùng khoảng nửa mở `[checkIn, checkOut)`. Điều kiện trùng: cùng room, booking `confirmed`, `newStart < oldEnd && newEnd > oldStart`. Khi sửa loại booking đang sửa khỏi kiểm tra. Ngày trả bằng ngày nhận của lịch khác được phép.
- Không tạo/sửa lịch `confirmed` nếu ngày trả <= ngày nhận hoặc trùng lịch. Hủy lặp lại không làm thay đổi lịch khác. Không tự phục hồi booking đã hủy qua nút sửa.
- Trạng thái room không tự suy ra từ booking; `occupied` là trạng thái vận hành thủ công, kiểm tra availability dựa vào lịch và loại trừ `maintenance`.
- Điều kiện booking khi sửa được kiểm tra lại. Chuyển room sang maintenance/building inactive không tự hủy lịch đã có; giảm khả năng tạo/sửa lịch mới.
- Zustand chịu trách nhiệm validation trước mutation; form dùng cùng quy tắc để hiển thị lỗi. Lỗi không được ghi một phần state.
- localStorage lưu metadata JSON, không lưu base64/Blob. Khi ghi thất bại, giữ thay đổi trong memory và hiện cảnh báo chưa lưu bền vững; không báo đã lưu thành công. Khi dữ liệu hỏng, không âm thầm ghi đè: báo lỗi và cho xuất raw data/reset có xác nhận.
- Storage có `version: 1`; thêm ảnh vào dữ liệu cũ dùng `images: []`. Trước migration/reset phải giữ bản export. Không thêm migration không cần thiết cho schema chưa từng tồn tại.

### Giao diện

Routes `/buildings`, `/rooms`, `/bookings`; dùng router và trang 404 trong ứng dụng. Component form và confirm dialog dùng lại nếu có. Có label, lỗi liên kết field, keyboard focus, trạng thái loading/empty; chỉ dùng dữ liệu khách giả khi demo.

## 5. Phần ảnh — contract và vòng đời

### API tối thiểu

`POST /api/images?entityType=building|room&entityId=<id>` nhận body nhị phân một file, `Content-Type` phù hợp, `Origin` đúng `SITE_ORIGIN`. Không có multipart parser, URL fetch từ server, hay API CRUD bổ sung.

Trả `201` với `{ id, url600, url1200, width600: 600, width1200: 1200, height600, height1200, bytes600, bytes1200 }`. Lỗi `{ code, message }`: `400` metadata/ID không hợp lệ; `413` quá dung lượng; `415` sai định dạng; `422` không decode được, ảnh động, quá pixel hoặc rộng <1200; `429` đang xử lý ảnh khác; `507` ghi ảnh không đủ dung lượng; `500` lỗi nội bộ còn lại. Authentication tại Nginx trả `401`; Origin sai trả `403` tại dịch vụ.

`GET /api/health` trả `200` với `{ status: "ok", releaseId }` khi process hoạt động và thư mục ảnh có quyền ghi; trả `503` nếu storage không sẵn sàng. Không trả secret hoặc đường dẫn hệ thống. Đây không phải bảo đảm disk sẽ đủ cho mọi upload.

`ImageAsset` là response upload. UI lưu response đó vào `images` của entity; display danh sách dùng 600, xem lớn dùng 1200. Form cập nhật URL sau khi upload thành công và có nút bỏ liên kết ảnh.

### Xử lý

- Decode xác minh nội dung thực; không tin đuôi/MIME header. Dùng Sharp auto-orient trước đánh giá kích thước và resize; reject ảnh nhiều frame; giữ tỷ lệ, WebP quality 80, không giữ metadata EXIF/GPS.
- Service bind `127.0.0.1:3001`. Chỉ xử lý một ảnh tại một thời điểm; request kế tiếp nhận `429`, UI báo thử lại. Đặt timeout body 30 giây, đọc không quá 10 MiB dù không có Content-Length. Nginx giới hạn cùng dung lượng và rate upload 1 request/giây, burst 3, trả 429 khi vượt.
- ID nhận từ client chỉ cho phép `[A-Za-z0-9_-]{1,64}`; `entityType` enum. Server tự tạo `imageId` UUID, timestamp và nonce; không nhận đường dẫn/tên file client.
- Building: `/images/building-image/<entityId>/<imageId>/<unixSeconds>-<nonce>_600.webp` và `_1200.webp`.
- Room: `/images/room-image/<entityId>/<imageId>/<unixSeconds>-<nonce>_600.webp` và `_1200.webp`.
- Viết cả hai file vào thư mục tạm trong cùng filesystem; chỉ rename thư mục sang imageId cuối khi cả hai thành công. Lỗi không trả URL và dọn temp. Khởi động dọn temp cũ sau khi đã khóa process duy nhất. Không sửa asset đã publish.
- Upload sau khi entity đã được lưu, để không tạo ID tạm. Upload lỗi giữ metadata/ảnh trước đó; trạng thái upload không chặn các trang khác. Nút bỏ ảnh chỉ bỏ liên kết trong localStorage, không xóa file server tự động vì có thể browser khác còn tham chiếu.
- Không bảo đảm mọi file WebP nhỏ hơn mọi ảnh nguồn vốn đã nén tốt. Đo bytes cho bộ ảnh chụp mẫu; chứng minh resize + nén giảm dung lượng trên bộ mẫu, tránh cam kết tỷ lệ giảm cố định.
- Ảnh demo coi là public qua URL. Chưa có phân quyền ảnh riêng tư hoặc database tập trung.
- Files ngoài Git và ngoài release; cần backup riêng. Chưa có tự động garbage collection; theo dõi dung lượng và chỉ dọn bằng quy trình có danh sách tham chiếu/backup, không suy đoán từ một browser.

## 6. Task 2 và 3 — triển khai độc lập

Mỗi môi trường có filesystem, config, thông tin đăng nhập và dữ liệu ảnh riêng. AWS không proxy sang VPS hoặc lấy ảnh từ VPS.

```text
/srv/rental-hub/
  releases/<releaseId>/dist/             frontend production
  releases/<releaseId>/server-dist/      dịch vụ ảnh đã build
  releases/<releaseId>/node_modules/     dependency runtime của release
  releases/<releaseId>/release.json      commit và runtime version
  releases/<releaseId>/dist/release.json cùng manifest để kiểm tra HTTP
  current -> releases/<releaseId>
  shared/assets/                        asset frontend hash, giữ bản cũ
  shared/images/                        ảnh upload bền vững
  shared/tmp/                           temp image trên cùng filesystem
/etc/rental-hub/media.env                config riêng, không Git
/etc/rental-hub/upload.htpasswd          tài khoản upload, không Git
```

Nginx phục vụ `current/dist`, `/assets/` từ shared/assets, `/images/` từ shared/images, `/api/` proxy loopback. Chỉ route ứng dụng fallback `/index.html`; ảnh/JS/API thiếu trả lỗi đúng, không trả HTML 200. `index.html` và `release.json` no-cache; hashed assets/ảnh immutable có cache dài. Shared assets giữ asset cũ cho tab đang mở khi chuyển phiên bản. Media đọc releaseId từ manifest thuộc release chứa entrypoint, không dùng env cố định có thể sai SHA sau deploy. Local development có static image handler giới hạn trong imagesRoot để Vite proxy preview ảnh; production dùng Nginx.

SSH key, user deploy riêng, không chạy Node bằng root. Giữ một SSH session và xác minh session thứ hai trước khi tắt password/root login hoặc bật firewall. Nginx chỉ đọc dist/assets/images; user media chỉ cần ghi images/tmp; user deploy không được đọc mật khẩu nếu không cần.

VPS: SSH từ IP quản trị, public 80/443, không mở 3001/Vite. AWS: EC2 trong public subnet có route Internet Gateway và public address; Security Group chỉ cho 22 từ IP quản trị, 80/443 từ Internet; không mở 3001. IPv6 chỉ cấu hình nếu thực sự có địa chỉ/route, kiểm tra AAAA tránh DNS sai. EBS giữ ảnh qua app release, không thay cho backup; ghi rõ chính sách delete-on-termination trước dùng.

HTTPS khi có domain: DNS đúng A/AAAA, chứng chỉ ACME, HTTP chuyển HTTPS và kiểm tra renew. Upload có Basic Auth qua HTTPS; POST qua HTTP bị chặn. API kiểm tra Origin; không dùng CORS wildcard. Mật khẩu/SSH key/.env không đi vào frontend `VITE_*`, Git hay log.

Ghi runbook log: Nginx access/error, `journalctl -u rental-hub-media`, build/deploy log kèm releaseId, trạng thái instance/SG/disk. Không ghi body ảnh, khách hàng hay header Authorization vào log.

## 7. Task 4 — phiên bản, cập nhật và rollback

- Git remote lưu source, lockfile, script và template config. Không commit ảnh upload/secret/dist/node_modules. Task 1/3 đã có remote không tạo repo khác.
- `releaseId` là full commit SHA. Không dùng branch đang thay đổi làm định danh release. Clone/fetch exact commit vào thư mục mới; không build trong current.
- `npm ci`, kiểm tra TypeScript, tests, build frontend + media; cài dependency production trong release; tạo release.json. Failure ở đây giữ nguyên current/process cũ.
- Lock deploy/rollback chung bằng `flock`; timeout trả lỗi, không hai lần deploy đồng thời. Không ghi đè release đã hoàn thành; redeploy cùng SHA kiểm tra manifest và dùng lại hoặc fail rõ ràng.
- Chuẩn bị assets hash trong shared trước activation; cùng tên mà khác nội dung phải fail, không ghi đè. Candidate kiểm tra bằng server staging loopback, process media trên port 3002, cùng logic origin/storage nhưng **không bật write upload** và không dọn temp production. Candidate test xong tắt process staging trước activation.
- Chuyển symlink qua symlink tạm + atomic rename cùng filesystem; restart media, chạy smoke HTTP, route con, asset thực, releaseId và health. Lỗi sau activation phục hồi symlink cũ + restart service cũ rồi kiểm tra lại; exit khác 0 cả khi phục hồi thành công. Lần deploy đầu lỗi phải báo không có release cũ, không tuyên bố rollback thành công.
- Static frontend tiếp tục được Nginx phục vụ khi media restart; upload có thể gián đoạn ngắn. Không cam kết zero downtime cho media.
- Rollback chọn releaseId đã build, kiểm tra còn runtime/assets trước đổi symlink; không rebuild commit cũ. Giữ tối thiểu 3 release hoàn chỉnh và luôn giữ current + previous; dọn sau nghiệm thu, không dọn images/shared assets tự động.
- Rollback code không khôi phục localStorage hoặc ảnh đã bị xóa bởi thao tác ngoài hệ thống. Schema storage trong scope giữ tương thích field ảnh optional; release không tương thích schema bị chặn tới khi có backup/migration/rollback dữ liệu riêng.
- Baseline dùng shell scripts; CI/CD không bắt buộc. Có thể nối CI vào cùng script sau khi đã chứng minh deploy/rollback trên cả VPS/AWS, không thêm một đường triển khai khác.

## 8. Task 5 — kiểm thử và sự cố

- Unit: quy tắc dữ liệu, dates/overlap, persistence, encode ảnh và cleanup.
- Browser: CRUD, lọc, booking, ảnh, reload, cảnh báo storage, production build; chạy trên cả hai origin, không dùng HTTP 200 thay cho kiểm tra React render.
- Server: `nginx -t`, status service, loopback/public curl, file MIME, firewall/SG, TLS, log và version.
- Fault drills chỉ trên môi trường thử nghiệm hoặc cửa sổ demo được phép, có backup cấu hình và đường SSH cứu hộ. Không khóa SSH hoặc sửa SG production để chứng minh lỗi.
- 403: quyền traverse/read/alias/auth; 404: sai root/asset/route/image; 502: media process/upstream/port. Static frontend không tự sinh 502 khi Node ảnh chết; kiểm tra trên `/api/health` hoặc upload.
- Build pass/frontend fail: browser Console/Network, base path, missing hashed asset, cache và build-time config; sửa nguyên nhân hoặc rollback.
- Website timeout: DNS → public address/route → firewall/SG → port listen → Nginx → app; phân biệt timeout với HTTP error.
- HTTPS: DNS/AAAA, 443, server_name, chain, expiry, clock và renew. Disk full: capacity + permissions; không xóa ảnh để cứu build.
- Mỗi drill có triệu chứng, evidence, root cause, cách sửa, lệnh kiểm chứng sau sửa và thời gian khôi phục.

## 9. Điều kiện nghiệm thu và thứ tự

1. Task 1 đủ CRUD/filter/booking, validation đúng, dữ liệu tồn tại sau refresh.
2. Ảnh upload building/room trả hai WebP đúng width, URL chạy sau refresh; input sai không tạo ảnh dở.
3. Task 2 và 3 có URL ngoài, deep-link refresh chạy, static asset thiếu 404, log xem được; ảnh độc lập giữa hai môi trường.
4. Task 4 demo release A → B → A trên cả hai môi trường, checksum ảnh không đổi; build fail/candidate fail giữ A, active smoke fail tự phục hồi A.
5. Task 5 hoàn thành các drill có evidence; không cần dashboard monitoring, Kubernetes, database hoặc phân quyền sản phẩm.

Thứ tự làm: nghiệm thu task 1 đã có → bổ sung ảnh local → VPS → nghiệm thu/tích hợp AWS đã có → release/rollback cả hai → drill và demo. Kế hoạch chia riêng theo subsystem để từng phần kiểm thử và review được.

## 10. Tham khảo chính thức

- [Nginx: try_files, alias, giới hạn body](https://nginx.org/en/docs/http/ngx_http_core_module.html).
- [Sharp: resize](https://sharp.pixelplumbing.com/api-resize/), [WebP/output metadata](https://sharp.pixelplumbing.com/api-output/), [input pixel limits](https://sharp.pixelplumbing.com/api-constructor/).
- [AWS: EC2 Security Groups](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html).
- [Node.js: release schedule và LTS](https://nodejs.org/en/about/previous-releases).

Các giá trị 600/1200, quality 80, 10 MiB, 20 MP, 5 ảnh và cấu trúc URL là quyết định thiết kế đề xuất; không phải mặc định bắt buộc của thư viện hay giá trị mentor đã xác nhận.
