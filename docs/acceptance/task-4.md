# Task 4 — Trạng thái nghiệm thu

- [x] Build release theo full Git SHA; lockfile và manifest; checksum runtime/assets.
- [x] Deploy/rollback dùng một lock; candidate read-only; atomic switch và recovery.
- [x] Linux fixture: A → B → A; lỗi build/candidate/activation; TERM, lock timeout, missing runtime, asset collision, giữ ảnh và asset cũ.
- [x] AWS script có rollback S3 index VersionId, kiểm tra asset và tự phục hồi index; transport giả đã kiểm thử, không gọi AWS thật.
- [x] Linux sandbox build SHA `67c5a2978f2226175097f130f7391aa7045d1940`, deploy/rollback fixtures và kiểm tra checksum; AWS rollback mock chạy đạt, không gửi request AWS.
- [x] EC2 nhận Git bundle chứa đúng full SHA; không cần push nhánh thử nghiệm lên remote.
- [x] EC2 public: A `9b87730158542d524bcd470ca38a887a67cb04fd` → B `e8fe7e9b20122711f065d1a2ad497a181e3562c8` → A; mỗi bước smoke HTTPS đạt. B chỉ cập nhật hạ tầng/tài liệu, nên giao diện giống A. Bốn ảnh WebP giữ nguyên checksum tổng `047f57d74e98fc15db34bc27f565007d4a5be87c022bc1d39e309519e8f31e0a`.
- [x] S3/CloudFront thật: index A VersionId `aXXCAkRTSgZzAEkeSxoP1NS8bQ3jwgA3` → B `NO3rmgYsOuSEpG8K9i5l3t9d69AqWVa4` → A → B. Mỗi lần chuyển đều chờ invalidation và smoke HTTPS 200; marker `release-sha` biến mất ở A và trở lại SHA `97a8eea8d05ad7d5b008e957fae184ffb7f6b652` ở B. Tài nguyên Terraform Task 3 không thay đổi.
- [x] EC2 và CloudFront cùng nhận SHA `main` qua `ops/aws/deploy-main.ps1` sau CI; khi DNS CloudFront tạm lỗi trong smoke, S3 tự khôi phục index A và EC2 tự rollback A. Lần phát hành lại thành công.

AWS Task 3 giữ nguyên; Task 4 AWS là quy trình riêng theo S3/CloudFront, không dùng filesystem/symlink EC2. Sau diễn tập, bản `main` được kích hoạt lại trên cả hai môi trường.
