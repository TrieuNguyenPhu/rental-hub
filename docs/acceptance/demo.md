# Demo mentor — thứ tự trình bày

1. Kiến trúc: AWS S3/CloudFront đã hoàn thành; Task 2 demo trên EC2 có Nginx + Node media độc lập với S3/CloudFront. Metadata ở localStorage từng origin; ảnh EC2 ở shared/images.
2. CRUD building/room, validation, booking overlap/adjacent dates/cancel; reload giữ dữ liệu. Dùng context demo.
3. Upload building/room, xem WebP 600/1200. Trình bày giới hạn HTTP/HTTPS và trạng thái acceptance thật.
4. EC2 public: direct `/rooms`, reload, release/health SHA, log, firewall và TLS.
5. Task 4 EC2: build SHA mới, A → B → A, checksum ảnh. AWS S3/CloudFront dùng VersionId của index riêng và chưa diễn tập live.
6. Một lỗi 502/404 và cách tìm nguyên nhân, fix, kiểm tra lại. Diễn tập 502 trên EC2 đã phục hồi; các lỗi còn lại thử trong sandbox.

Tài liệu đi kèm: [Task 2](task-2.md), [Task 4](task-4.md), [Task 5](task-5.md), [VPS](../deploy/vps.md), [Release](../deploy/releases.md), [Troubleshooting](../runbook/troubleshooting.md), [AWS đã nghiệm thu](../task3-aws-deployment.md).

Giới hạn phải công khai: EC2 demo dùng AWS credit và đang chờ người dùng xem trước khi xóa; metadata không đồng bộ; ảnh public, bỏ liên kết không xóa file; xóa instance sẽ xóa ảnh trên root volume; media restart có gián đoạn; rollback không phục hồi localStorage; rollback AWS index cần giữ assets tương thích.
