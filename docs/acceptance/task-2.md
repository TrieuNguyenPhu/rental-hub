# Task 2 — Trạng thái nghiệm thu

Ngày 2026-10-14. Theo yêu cầu mới, Task 2 được chạy thử trên EC2 độc lập với S3/CloudFront của Task 3. AWS Free Plan còn 140 USD credit khi cấp máy; máy vẫn đang chạy để người dùng xem trước khi xóa.

- [x] Nginx HTTP/HTTPS/candidate templates; tách SPA, assets, images, API.
- [x] systemd unit non-root, env templates, runbook SSH/filesystem/firewall/HTTPS.
- [x] Ubuntu WSL sandbox chạy Nginx HTTPS thật + Node media bằng systemd dưới user không đặc quyền; health, upload/read WebP, auth 401, origin 403 và ACL đọc ảnh được xác minh.
- [x] EC2 Ubuntu 24.04 `t3.small` được cấp bằng Terraform riêng; SSH key và đăng nhập SSH được xác minh. Session cứu hộ độc lập chưa thử.
- [x] Build từ Git commit đầy đủ trên EC2; media systemd `active`, chạy bằng `rental-hub-media`.
- [x] UFW và Security Group chỉ mở 22 từ IP quản trị, 80/443 công khai; port 3001 không truy cập được từ ngoài.
- [x] URL công khai <https://3-26-186-22.sslip.io/> chạy SHA `9b87730158542d524bcd470ca38a887a67cb04fd`; smoke và Playwright production 2/2 đạt, gồm tạo building/room, refresh, asset MIME/404 và ảnh WebP building/room.
- [x] Let's Encrypt TLS hợp lệ; HTTP upload trả 403, HTTPS Basic Auth không đăng nhập trả 401, Origin sai trả 403; Nginx access log và journal media ghi nhận request. `certbot renew --dry-run` thành công.
- [x] Diễn tập dừng media: `/api/health` trả 502, SPA `/rooms` vẫn 200; khởi động lại và smoke công khai đạt.

EC2 là máy demo có thời hạn, không phải VPS miễn phí vĩnh viễn. Credit AWS được dùng khi máy chạy; billing có thể cập nhật chậm. Terraform state giữ tại `infra/ec2` để xóa đúng máy sau khi người dùng xác nhận đã xem. `delete_on_termination=true`, nên ảnh trên volume sẽ mất khi xóa. Dữ liệu metadata trong localStorage của mỗi trình duyệt không đồng bộ. AWS Task 3 không thay đổi.
