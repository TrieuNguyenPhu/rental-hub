# Task 4 — Trạng thái nghiệm thu

- [x] Build release theo full Git SHA; lockfile và manifest; checksum runtime/assets.
- [x] Deploy/rollback dùng một lock; candidate read-only; atomic switch và recovery.
- [x] Linux fixture: A → B → A; lỗi build/candidate/activation; TERM, lock timeout, missing runtime, asset collision, giữ ảnh và asset cũ.
- [x] AWS script có rollback S3 index VersionId, kiểm tra asset và tự phục hồi index; transport giả đã kiểm thử, không gọi AWS thật.
- [x] Linux sandbox build SHA `67c5a2978f2226175097f130f7391aa7045d1940`, deploy/rollback fixtures và kiểm tra checksum; AWS rollback mock chạy đạt, không gửi request AWS.
- [ ] Source branch đã push/merge để VPS clone đúng SHA.
- [ ] A → B → A và checksum ảnh trên VPS public.
- [ ] A → B → A trên AWS thật trong cửa sổ demo được phép.

Không coi test fixture hoặc PowerShell mock là bằng chứng diễn tập trên hạ tầng thật. Public VPS và AWS live rollback vẫn pending. AWS Task 3 giữ nguyên; Task 4 AWS là quy trình riêng theo S3/CloudFront, không dùng filesystem/symlink VPS.
