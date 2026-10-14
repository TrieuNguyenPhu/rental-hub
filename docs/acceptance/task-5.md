# Task 5 — Trạng thái nghiệm thu

- [x] Runbook timeout, 403/404/502, routing, MIME/bundle/cache, auth, TLS, disk và rollback.
- [x] Production Playwright checks nhận SITE_URL/EXPECTED_RELEASE và credential từ môi trường; tái dùng app CRUD tests trong context riêng.
- [x] Shell failure tests và AWS transport tests; test suite App/Images 44/44.
- [ ] Ghi evidence thực tế bản build qua Nginx + media + browser local.
- [ ] Public VPS production/browser/HTTPS và fault drill được phép.
- [ ] AWS Task 4 live rollback evidence (Task 3 không làm lại).

Kiểm thử local chỉ dùng dữ liệu demo; mock/fault injection phải ghi rõ. Không lưu secret trong repo, test traces khi có Basic Auth bị tắt.
