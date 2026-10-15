# Task 2 — Chưa hoàn thành trên VPS

Task 2 yêu cầu triển khai website trên VPS Linux độc lập với môi trường AWS của Task 3. Hiện chưa có bằng chứng VPS của Task 2 đã được cấu hình và nghiệm thu. Template, script và thử nghiệm dưới đây là phần chuẩn bị, không thay cho việc truy cập được một VPS từ Internet.

## Đã chuẩn bị và thử tại máy

- [x] Nginx HTTP/HTTPS/candidate templates; tách SPA, assets, images và API.
- [x] systemd unit non-root, env templates, runbook SSH/filesystem/firewall/HTTPS.
- [x] Ubuntu WSL sandbox chạy Nginx HTTPS + Node media bằng systemd dưới user không đặc quyền; đã kiểm tra health, WebP, Basic Auth, Origin và quyền đọc ảnh.

## Còn phải làm trên VPS của Task 2

- [ ] Xác nhận VPS Linux sẽ dùng và kết nối SSH bằng tài khoản triển khai.
- [ ] Đưa source lên VPS, build đúng Git commit và chạy media bằng systemd.
- [ ] Cấu hình Nginx, firewall/port và kiểm tra website từ mạng ngoài, gồm refresh trang con.
- [ ] Cấu hình domain/HTTPS nếu có domain; kiểm tra upload ảnh building/room và log.
- [ ] Cập nhật phiên bản mới, rollback sau lỗi và kiểm tra lại website công khai.

## Hồ sơ thử nghiệm EC2 trước đây

Ngày 2026-10-14, một EC2 Ubuntu 24.04 `t3.small` đã được dùng để thử riêng các bước SSH, build, Nginx, UFW/Security Group, Let's Encrypt, media, WebP và phục hồi lỗi 502. URL <https://3-26-186-22.sslip.io/> khi đó chạy SHA `9b87730158542d524bcd470ca38a887a67cb04fd`; smoke và Playwright production 2/2 đạt. Đây là bằng chứng thử quy trình trên EC2 tại thời điểm đó, **không phải nghiệm thu Task 2 trên VPS** và không xác nhận URL còn hoạt động hiện nay.

Cấu hình EC2 thử nghiệm đã được bỏ khỏi source ngày 2026-10-14; việc dọn source không thực hiện teardown AWS. Instance đã dùng là `i-0ece2455235401517`, cần đối chiếu trong AWS hoặc bản state lưu riêng nếu muốn kiểm tra hoặc dọn tài nguyên. Nếu máy còn chạy, credit AWS vẫn được dùng. `delete_on_termination=true`, nên ảnh trên volume sẽ mất khi xóa máy. Metadata trên EC2 nằm trong localStorage từng trình duyệt, không đồng bộ. AWS Task 3 không thay đổi.
