# Phương án đáp ứng bài thực tập: VPS + S3/CloudFront

Ngày: 13/10/2026. Lựa chọn kiến trúc: giữ ứng dụng frontend hiện tại. AWS Task 3 đã triển khai tại Sydney, quản lý bằng Terraform; VPS Task 2 chưa thực hiện. Xem [kết quả, cấu hình và vận hành AWS](task3-aws-deployment.md). Nội dung dưới đây là phương án ban đầu; cấu hình thực tế AWS dùng fallback 403/404 theo sơ đồ người dùng.

## Quyết định và lý do

React + TypeScript + Zustand + localStorage đáp ứng kiến trúc Task 1 được trainer cho phép. Task 3 cho phép S3 + CloudFront phục vụ frontend tĩnh; không yêu cầu backend, database hoặc ba lớp hạ tầng.

Chọn VPS Linux + Nginx để thực hành SSH, Linux, build, firewall, log và HTTPS. Chọn S3 private + CloudFront để triển khai AWS độc lập, thực hành IAM, bucket policy, CDN, cache, routing và rollback. Thay thế đề xuất ba lớp trước đó; không thêm EC2/RDS vào môi trường AWS.

## Mô hình

- VPS: trình duyệt -> Nginx -> frontend production build trên Linux.
- AWS: trình duyệt -> HTTPS CloudFront -> S3 private chứa frontend production build.
- Cả hai: CRUD và validation chạy trong React/Zustand, dữ liệu nghiệp vụ nằm trong localStorage của trình duyệt.

Không dùng S3 để lưu hoặc nhận request CRUD dữ liệu khách hàng. Bucket chỉ chứa HTML, CSS, JavaScript, font và asset công khai của ứng dụng.

## Task 1: giữ chức năng hiện có, xác minh trước deploy

- Tòa nhà: thêm/sửa/xóa, tìm theo tên, đầy đủ trường yêu cầu.
- Phòng: thêm/sửa/xóa, liên kết tòa nhà, lọc tòa nhà/trạng thái.
- Booking: thêm/sửa/hủy; ngày trả sau ngày nhận, không trùng cùng phòng, booking đã hủy giữ lịch sử.
- Xác minh các ràng buộc liên kết, dữ liệu tồn tại sau reload và báo lỗi khi localStorage không ghi được.
- Chạy typecheck, lint, unit và Playwright; sửa lỗi được tìm thấy trước khi phát hành.
- Duy trì khóa và schema localStorage qua release để cập nhật/rollback code không tự reset dữ liệu.

## Task 2: VPS

1. SSH bằng key; dùng user deploy, xác minh host key.
2. Cài Git, Node/npm phù hợp dự án, Nginx và công cụ firewall.
3. Lấy source của release từ Git vào `/var/www/estateflow/releases/<release-id>/`; chạy `npm ci` và production build ngay trên VPS trong thư mục mới.
4. Nginx root trỏ `/var/www/estateflow/current/dist`; `current` là symlink tới release đã xác minh.
5. SPA dùng `try_files $uri $uri/ /index.html`; `/assets/` riêng trả 404 nếu file không tồn tại, tránh trả HTML thay JavaScript.
6. Cho phép SSH từ IP quản trị trước khi bật firewall; mở 80/443 khi cần. Không dùng Vite dev server để phục vụ production.
7. Có domain thì trỏ DNS và cấu hình HTTPS, kiểm tra tự gia hạn; chưa có domain thì demo bằng public IP và ghi rõ HTTP.
8. Kiểm tra Nginx config, service, file permissions, access/error log; kiểm tra URL từ bên ngoài mạng server.

## Task 3: AWS

1. S3 bucket bật Block Public Access, Object Ownership mặc định và mã hóa mặc định.
2. CloudFront dùng S3 REST origin, OAC với always sign; bucket policy cho đúng distribution đọc object. Không dùng S3 website endpoint với OAC.
3. Redirect HTTP -> HTTPS; hostname mặc định CloudFront dùng được khi chưa có domain. Domain riêng dùng ACM certificate ở `us-east-1`.
4. CloudFront Function viewer-request rewrite route React về `/index.html`; `/assets/`, font và file tĩnh giữ nguyên, không che asset lỗi bằng HTML. Cần kiểm tra feature này trong Free account plan trước khi cấu hình.
5. Default root object `index.html`; assets hash cache dài, index cache ngắn hoặc revalidate. Cache policy phải cho phép TTL ngắn của index.
6. IAM deploy chỉ được ghi prefix/bucket cần thiết và invalidate distribution cụ thể. Nếu CI dùng OIDC, giới hạn trust theo repository/branch hoặc environment.
7. Xác minh CloudFront deployment status, 4xx/5xx metrics; bật access logging với retention/lifecycle phù hợp ngân sách để thực hành đọc log.
8. Test bằng URL ngoài Internet: CRUD, reload route con, asset MIME type, HTTPS và version đang phục vụ.

AWS dùng S3/CloudFront nên không có Security Group hoặc port Nginx để cấu hình. Bảo vệ truy cập bằng IAM, OAC, bucket policy và HTTPS; phần Linux/firewall thực hiện trên VPS.

## Task 4: cập nhật và rollback

- Source có Git repository/remote, release tag hoặc commit SHA; giữ artifact và manifest của từng release. Không đưa `.env`, SSH key hoặc AWS credential vào Git/frontend.
- Quy trình chung: kiểm tra -> build release mới -> deploy -> smoke test -> xác nhận release; serialize deploy/rollback để tránh hai lần phát hành ghi đè nhau.
- VPS: build ở release directory mới; chỉ đổi symlink bằng thao tác atomic sau khi build/kiểm tra thành công. Smoke test thất bại thì trả symlink về bản cũ. Giữ release trước để rollback; bảo đảm asset hash cũ vẫn phục vụ được cho tab đang mở khi cần.
- AWS: lưu full artifact theo release và bật S3 Versioning. Upload asset mới trước, giữ asset cũ, upload `index.html` sau cùng. Invalidate index; không `sync --delete` hoặc xóa bucket đang phục vụ.
- Rollback AWS: khôi phục artifact/version manifest của release trước, gồm file tĩnh không có hash nếu đã thay đổi; khôi phục index sau cùng rồi invalidate. Chỉ bật Versioning không tạo ra rollback toàn bộ release tự động.
- Build lỗi thì không chạy bước publish. Upload/publish hoặc smoke test lỗi phải báo failed và có đường khôi phục release trước.
- S3/CloudFront không chuyển toàn bộ release atomically; giữ asset cũ và entrypoint publish cuối để giảm cửa sổ không nhất quán. Rollback còn phụ thuộc cache/propagation, phải kiểm tra URL sau invalidation.
- VPS và AWS phát hành độc lập từ cùng Git release; không phụ thuộc server kia hoạt động. Lưu version metadata trong artifact để kiểm tra release đang chạy.

## Task 5 và bằng chứng hoàn thành

| Kiểm tra/sự cố | Bằng chứng cần có |
| --- | --- |
| Website không truy cập được | Phân biệt DNS/network/TLS, service Nginx hoặc CloudFront origin/permissions |
| VPS 403/404 | Kiểm tra quyền đọc/traverse thư mục, root, index và SPA fallback |
| Nginx 502 | Với static site không có upstream, 502 thường cho thấy cấu hình proxy thừa hoặc đi nhầm server block; đọc config/log trước khi sửa |
| AWS 403 | Kiểm tra key/path S3, OAC và bucket policy; không mở bucket public để né lỗi |
| Trang trắng sau build | Network/console, đường dẫn base, JS/CSS MIME type, asset thiếu và cache cũ |
| Refresh route con | Test trực tiếp `/buildings`, `/rooms`, `/bookings` rồi reload trên cả hai URL |
| Firewall/HTTPS/domain sai | Kiểm tra port, DNS, certificate, redirect và gia hạn trên VPS; certificate/alias CloudFront nếu có domain |
| Release lỗi | Demo rollback trên cả hai môi trường, kiểm tra version và CRUD sau rollback |

Nghiệm thu chỉ khi có: URL VPS, URL CloudFront, Git commit/tag, kết quả CRUD và reload, log minh họa, một lần cập nhật thành công, một lần build lỗi giữ nguyên release đang chạy và một lần rollback trên từng môi trường.

## Chi phí và giới hạn

Không có EC2/RDS chạy liên tục ở AWS. Chi phí tùy dung lượng S3, version cũ, request, traffic CloudFront, logging và invalidation; kiểm tra lựa chọn dịch vụ/feature, billing và credit trong Console, không mặc định mọi thứ miễn phí. Giới hạn retention cho log và version cũ để tránh tích lũy không cần thiết.

Free account plan kết thúc khi hết credit hoặc sáu tháng từ ngày mở tài khoản, tùy điều kiện đến trước. Không tự chuyển Paid plan để vượt giới hạn. Chi phí VPS và domain riêng không nằm trong AWS credit.

localStorage là giới hạn chấp nhận được cho bài tập: dữ liệu riêng từng trình duyệt/origin, không đồng bộ giữa VPS và CloudFront; xóa browser storage có thể mất dữ liệu. Booking overlap chỉ được kiểm tra trong bộ dữ liệu của trình duyệt đó. Đây không phải hệ thống đặt phòng dùng chung cho nhiều người. Dùng dữ liệu khách hàng giả khi demo.

## Nguồn

- [S3 private origin + OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [CloudFront Functions URI rewrite](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example_cloudfront_functions_url_rewrite_single_page_apps_section.html) — React cần rewrite về root index, không append index vào mỗi thư mục.
- [CloudFront invalidation/versioned filenames](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html)
- [AWS Free account plan](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html)
