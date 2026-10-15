# Task 4 — Trạng thái nghiệm thu

Phần AWS đã được diễn tập trên S3/CloudFront thật. Quy trình VPS đã có script và kiểm thử trong sandbox Linux, nhưng Task 4 **chưa hoàn thành trên VPS của Task 2** vì môi trường đó chưa được triển khai.

- [x] Build release theo full Git SHA; lockfile và manifest; checksum runtime/assets.
- [x] Deploy/rollback dùng một lock; candidate read-only; atomic switch và recovery.
- [x] Linux fixture: A → B → A; lỗi build/candidate/activation; TERM, lock timeout, missing runtime, asset collision, giữ ảnh và asset cũ.
- [x] AWS script có rollback S3 index VersionId, kiểm tra asset và tự phục hồi index; bước kiểm thử bằng transport giả không gọi AWS thật.
- [x] Linux sandbox build SHA `67c5a2978f2226175097f130f7391aa7045d1940`, deploy/rollback fixtures và kiểm tra checksum; AWS rollback mock chạy đạt, không gửi request AWS.
- [x] S3/CloudFront thật: index A VersionId `aXXCAkRTSgZzAEkeSxoP1NS8bQ3jwgA3` → B `NO3rmgYsOuSEpG8K9i5l3t9d69AqWVa4` → A → B. Mỗi lần chuyển đều chờ invalidation và smoke HTTPS 200; marker `release-sha` biến mất ở A và trở lại SHA `97a8eea8d05ad7d5b008e957fae184ffb7f6b652` ở B. Tài nguyên Terraform Task 3 không thay đổi.
- [ ] VPS của Task 2: deploy bản mới, gây lỗi, rollback về bản tốt và kiểm tra dữ liệu/ảnh vẫn còn.

Hồ sơ thử nghiệm EC2 ngày 2026-10-14: EC2 nhận Git bundle đúng full SHA; release A `9b87730158542d524bcd470ca38a887a67cb04fd` → B `e8fe7e9b20122711f065d1a2ad497a181e3562c8` → A, mỗi bước smoke HTTPS đạt. B chỉ đổi hạ tầng/tài liệu; bốn ảnh WebP giữ checksum tổng `047f57d74e98fc15db34bc27f565007d4a5be87c022bc1d39e309519e8f31e0a`. Sau CI, `ops/aws/deploy-main.ps1` từng chuyển cùng SHA `main` lên EC2 và CloudFront; một lần DNS CloudFront lỗi đã kích hoạt tự phục hồi hai bên trước khi phát hành lại thành công. Đây là thử nghiệm lịch sử trên EC2, không thay thế nghiệm thu VPS của Task 2.

AWS Task 3 giữ nguyên; Task 4 AWS là quy trình riêng theo S3/CloudFront, không dùng filesystem/symlink VPS. Sau diễn tập, bản `main` đã được kích hoạt lại trên CloudFront và EC2 thử nghiệm tại thời điểm đó.
