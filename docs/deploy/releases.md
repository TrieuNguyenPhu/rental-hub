# Release và rollback

## VPS

Quy trình dùng các script trong `ops/release/`; chưa có VPS đang vận hành theo runbook này. Chạy bằng deploy user trên Ubuntu, không chạy bằng root. `/etc/rental-hub/deploy.env` chỉ cho deploy/root đọc và ghi. APP_ROOT phải có các thư mục thật `releases`, `shared/assets`, `shared/images`, `shared/tmp`.

```bash
git fetch origin
git rev-parse origin/main
bash ops/release/build-release.sh FULL_SHA /etc/rental-hub/deploy.env
bash ops/release/deploy.sh FULL_SHA /etc/rental-hub/deploy.env
bash ops/release/rollback.sh OLD_FULL_SHA /etc/rental-hub/deploy.env
```

Build lấy đúng full SHA, chạy lint, typecheck, unit test và frontend/media build, rồi kiểm tra runtime Sharp và checksum release. Release hoàn chỉnh không bị ghi đè. Deploy kiểm tra candidate trên loopback, chuyển symlink bằng rename, restart media và smoke test public. Nếu lỗi sau khi chuyển, script phục hồi release cũ và kiểm tra lại; khi báo `RECOVERY FAILED`, xử lý theo [runbook sự cố](../runbook/troubleshooting.md).

Rollback dùng release đã build, không chạy lại npm/git/build. Không tự xóa release, asset hoặc ảnh; giữ current, previous và các bản còn cần để phục hồi. Backup ảnh và dữ liệu trình duyệt riêng. Restart media có thể gián đoạn upload ngắn; mất điện, hỏng ổ hoặc `kill -9` cần kiểm tra symlink và service thủ công.

## AWS

AWS dùng S3 VersionId và CloudFront invalidation, không dùng symlink hoặc script VPS. Xem [deploy và rollback AWS](aws.md).

## Kiểm tra script

```bash
bash tests/operations/release.sh
shellcheck -x ops/release/*.sh
```

```powershell
powershell -NoProfile -File tests/operations/aws-rollback.ps1
```

Các fixture trên không truy cập production AWS/VPS. Kiểm tra E2E trên môi trường thật cần URL riêng và dữ liệu thử nghiệm; không đưa credential vào repo hoặc log.
