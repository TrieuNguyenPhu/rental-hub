# Task 2 — Trạng thái nghiệm thu

Ngày 2026-10-14. Người dùng chưa có tài khoản/VPS, yêu cầu chi phí 0đ.

- [x] Nginx HTTP/HTTPS/candidate templates; tách SPA, assets, images, API.
- [x] systemd unit non-root, env templates, runbook SSH/filesystem/firewall/HTTPS.
- [x] Ubuntu WSL sandbox chạy Nginx HTTPS thật + Node media bằng systemd dưới user không đặc quyền; health, upload/read WebP, auth 401, origin 403 và ACL đọc ảnh được xác minh.
- [ ] VPS miễn phí đã được cấp, SSH key + session cứu hộ được xác minh.
- [ ] Cài đặt trên VPS thật và kiểm tra unit chạy bằng user media.
- [ ] Firewall host/nhà cung cấp và port được xác minh từ ngoài.
- [ ] URL public và full SHA; CRUD/refresh/log trên VPS thật.
- [ ] Domain/TLS/renewal nếu có domain; upload HTTPS/Basic Auth từ Internet.

**Chưa hoàn thành Task 2 public**. Local dùng cert tự ký và không tạo hóa đơn; không thay thế VPS/IP/domain/firewall public. Hostinger bị loại vì VPS có phí trả trước. AWS Task 3 do người dùng hoàn tất trước kế hoạch; độc lập với VPS và không được triển khai lại.
