# Demo mentor — thứ tự trình bày

1. Kiến trúc: AWS S3/CloudFront đã hoàn thành; VPS Nginx + Node media độc lập. Metadata ở localStorage từng origin; ảnh VPS ở shared/images.
2. CRUD building/room, validation, booking overlap/adjacent dates/cancel; reload giữ dữ liệu. Dùng context demo.
3. Upload building/room, xem WebP 600/1200. Trình bày giới hạn HTTP/HTTPS và trạng thái acceptance thật.
4. VPS public: direct `/rooms`, reload, release/health SHA, log, firewall; chỉ trình bày khi Task 2 public đã đạt.
5. Task 4 VPS: build SHA mới, A → B → A, checksum ảnh; mở tab cũ chứng minh old asset còn. AWS dùng VersionId của index riêng.
6. Một lỗi 502/404 và cách tìm nguyên nhân, fix, kiểm tra lại. Mọi lỗi cố tình tạo chỉ trong sandbox.

Tài liệu đi kèm: [Task 2](task-2.md), [Task 4](task-4.md), [Task 5](task-5.md), [VPS](../deploy/vps.md), [Release](../deploy/releases.md), [Troubleshooting](../runbook/troubleshooting.md), [AWS đã nghiệm thu](../task3-aws-deployment.md).

Giới hạn phải công khai: chưa có VPS public; metadata không đồng bộ; ảnh public, bỏ liên kết không xóa file; cần backup disk/export browser; media restart có gián đoạn; rollback không phục hồi localStorage; rollback AWS index cần giữ assets tương thích.
