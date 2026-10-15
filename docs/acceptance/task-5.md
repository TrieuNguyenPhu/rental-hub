# Task 5 — Trạng thái nghiệm thu

Runbook và các bài diễn tập local/AWS đã có bằng chứng. Xử lý sự cố trên VPS của Task 2 còn chờ triển khai môi trường đó.

- [x] Runbook timeout, 403/404/502, routing, MIME/bundle/cache, auth, TLS, disk và rollback.
- [x] Production Playwright checks nhận SITE_URL/EXPECTED_RELEASE và credential từ môi trường; tái dùng app CRUD tests trong context riêng.
- [x] Shell failure tests và AWS transport tests; node tests 46 pass trên Windows (một kiểm tra POSIX bỏ qua tại Windows) và Linux build gate.
- [x] Browser local HTTPS 13/13; Nginx + systemd media thật, upload building/room 600/1200, 401/403/404; diễn tập dừng media 502 rồi phục hồi, quyền file 403 rồi phục hồi.
- [x] AWS Task 4 live rollback A → B → A → B; CloudFront 11/11 Playwright app tests.
- [ ] VPS của Task 2: kiểm tra và xử lý lỗi truy cập, 403/404/502, refresh trang con, firewall/port, HTTPS và rollback trên máy thật.

Hồ sơ EC2 thử nghiệm ngày 2026-10-14: public HTTPS Playwright production 2/2, certbot renewal dry run, media 502 rồi phục hồi, SPA vẫn 200; 403 upload HTTP, 404 asset và ảnh building/room đã được xác minh. Đây là thử nghiệm trên EC2, chưa phải nghiệm thu VPS của Task 2.

Kiểm thử local chỉ dùng dữ liệu demo và cert tự ký. AWS rollback đã kiểm thử trên S3/CloudFront thật và bằng transport mock. Không lưu secret trong repo; test traces khi có Basic Auth bị tắt.
