# Task 4 — Cập nhật và rollback

## VPS

Quy trình đã được kiểm thử trong sandbox Linux và trên EC2 thử nghiệm trước đây; chưa nghiệm thu trên VPS của Task 2.

Lệnh chạy bằng deploy user trên VPS Ubuntu; config `/etc/rental-hub/deploy.env` thuộc deploy/root, không cho group/world ghi. APP_ROOT phải có sẵn `releases`, `shared/assets`, `shared/images`, `shared/tmp` là thư mục thật. Các lệnh dùng chung lock 30 giây, không chạy bằng root.

```bash
git fetch origin
git rev-parse origin/main
bash ops/release/build-release.sh FULL_SHA /etc/rental-hub/deploy.env
bash ops/release/deploy.sh FULL_SHA /etc/rental-hub/deploy.env
bash ops/release/rollback.sh OLD_FULL_SHA /etc/rental-hub/deploy.env
```

Build clone đúng SHA vào `.build.*`, chạy lint/types/tests/build/media build, cài runtime bằng lockfile và kiểm tra Sharp. Manifest đi cùng frontend/runtime; checksum bao phủ dist, server-dist, runtime và package files. Release hoàn chỉnh được dùng lại; không ghi đè. Build lỗi chỉ dọn thư mục tạm của lần đó.

Deploy kiểm tra release, giữ asset hash cũ, từ chối cùng tên khác bytes, kiểm tra candidate trên 8081/3002 rồi đổi symlink bằng rename. systemd restart và public smoke phải trả đúng SHA. Lỗi hoặc TERM/INT sau switch sẽ phục hồi current cũ, restart và kiểm tra lại; lệnh vẫn báo thất bại. Nếu recovery cũng lỗi, xử lý `RECOVERY FAILED` theo runbook. Lần đầu chưa có previous thì dừng media, bỏ current và báo rõ.

Rollback dùng bản đã build, không npm/git/build lại. Không dọn release, ảnh hoặc assets tự động: luôn giữ current, previous và tối thiểu ba release hoàn chỉnh khi đã có ba bản. Giám sát disk, backup ảnh; xóa release cũ chỉ sau khi biết chắc không phải current/previous/target cần rollback. Upload có thể gián đoạn ngắn khi restart media. `kill -9`, host mất điện và hỏng ổ đĩa không chạy được shell trap: kiểm tra symlink/unit rồi rollback thủ công.

## AWS S3/CloudFront — độc lập

Task 3 giữ nguyên. Không thêm EC2, API ảnh, bucket hoặc kết nối tới VPS. Script AWS dùng Terraform outputs/state hiện có tại máy vận hành; không copy credential/state vào Git.

```powershell
# Xem bản dự kiến; build/check diễn ra nhưng -WhatIf không upload.
.\ops\aws\deploy-aws.ps1 -WhatIf
# Cập nhật khi sẵn sàng.
.\ops\aws\deploy-aws.ps1 -Confirm:$false
# Xem các version index (điền bucket đã có từ Terraform outputs).
aws s3api list-object-versions --bucket ACTUAL_BUCKET --prefix index.html
# Chọn VersionId từ lần triển khai tốt đã ghi lại.
.\ops\aws\deploy-aws.ps1 -RollbackVersionId 'ACTUAL_VERSION_ID' -Confirm:$false
```

Script xác minh account/origin/domain và bucket versioning; lưu index hiện tại trước switch, giữ hashed assets và invalidation sau cùng. Rollback kiểm tra assets của index cũ còn trong S3, copy đúng version thành index mới, invalidation và smoke. Smoke lỗi tự phục hồi index vừa rời; không rebuild bản cũ. Các lệnh chỉ chạy từ một checkout/máy vận hành; lock local không khóa được máy khác.

Giới hạn rollback AWS: index + hashed assets; script từ chối ghi đè root public files (fonts/favicon) nếu bytes thay đổi. Khi đổi chúng, dùng filename mới để index cũ vẫn hoạt động. File cũ được giữ lại. CloudFront hiện có fallback 403/404 sang index 200, nên không dùng VPS smoke yêu cầu missing asset 404 để đánh giá lại Task 3.

Script AWS được kiểm thử bằng transport giả và đã diễn tập rollback A → B → A → B trên S3/CloudFront thật sau đó; xem [hồ sơ Task 4](../acceptance/task-4.md). Thử nghiệm đó không chứng minh quy trình VPS của Task 2 đã hoàn thành.

## Kiểm thử an toàn

```bash
# Ubuntu có Node 24, git, curl, Nginx, flock; không dùng sudo/service thật.
bash tests/operations/release.sh
shellcheck -x ops/release/*.sh
```

```powershell
# Không có request AWS thật trong bài tự kiểm tra này.
powershell -NoProfile -File tests/operations/aws-rollback.ps1
# VPS thật, metadata CRUD dùng context demo riêng.
$env:SITE_URL = 'https://ACTUAL_VPS_DOMAIN'
$env:EXPECTED_RELEASE = 'ACTUAL_FULL_SHA'
# UPLOAD_TEST_USER/PASSWORD được cấp qua môi trường; không viết vào repo/log.
npm run test:e2e -- --workers=1
```

Production tests tắt trace khi có credential để tránh lưu Authorization trong artifact. Thiếu credential thì upload test ghi skip, không tính là upload đã nghiệm thu. `LOCAL_TLS_TEST=1` chỉ chấp nhận cert tự ký khi hostname loopback, dành riêng cho sandbox local.
