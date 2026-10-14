# Task 5 — Trạng thái nghiệm thu

- [x] Runbook timeout, 403/404/502, routing, MIME/bundle/cache, auth, TLS, disk và rollback.
- [x] Production Playwright checks nhận SITE_URL/EXPECTED_RELEASE và credential từ môi trường; tái dùng app CRUD tests trong context riêng.
- [x] Shell failure tests và AWS transport tests; node tests 46 pass trên Windows (một kiểm tra POSIX bỏ qua tại Windows) và Linux build gate.
- [x] Browser local HTTPS 13/13; Nginx + systemd media thật, upload building/room 600/1200, 401/403/404; diễn tập dừng media 502 rồi phục hồi, quyền file 403 rồi phục hồi.
- [x] EC2 public HTTPS: Playwright production 2/2, certbot renewal dry run; media 502 rồi phục hồi, SPA vẫn 200; 403 upload HTTP và 404 asset được xác minh.
- [ ] AWS Task 4 live rollback evidence (Task 3 không làm lại).

Kiểm thử local chỉ dùng dữ liệu demo và cert tự ký; AWS rollback là transport mock, chưa gọi AWS. Không lưu secret trong repo, test traces khi có Basic Auth bị tắt.
