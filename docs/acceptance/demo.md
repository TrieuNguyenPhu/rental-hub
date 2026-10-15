# Demo mentor — thứ tự trình bày

**Trạng thái:** ứng dụng và AWS Task 3 đã triển khai; Task 2 trên VPS độc lập chưa làm. Không dùng URL EC2 thử nghiệm trước đây làm bằng chứng VPS hiện tại.

1. Giải thích kiến trúc: React/TypeScript/Zustand, localStorage cho local/VPS dự kiến, S3/CloudFront + API Gateway/Lambda cho AWS. Nêu rõ dữ liệu AWS là demo công khai.
2. Trình bày CRUD building/room, validation, booking trùng/ngày liền kề/hủy và reload trên bản local hoặc AWS demo.
3. Upload ảnh building/room; giải thích Sharp tạo WebP rộng 600/1200 px, lưu và hiển thị từng bản.
4. Trình bày AWS đang triển khai: refresh route, assets, log, quy trình phát hành và rollback S3 VersionId đã diễn tập trong [Task 4](task-4.md).
5. Trình bày runbook VPS và kết quả sandbox/EC2 trước đây như phần chuẩn bị. Chỉ demo SSH, Nginx, firewall, HTTPS, log và rollback VPS sau khi Task 2 được triển khai và kiểm tra từ Internet.
6. Giải thích cách xác định và xử lý một lỗi 403/404/502 bằng [runbook](../runbook/troubleshooting.md); phân biệt diễn tập local/AWS với kết quả trên VPS sau này.

Tài liệu đi kèm: [Task 2](task-2.md), [Task 4](task-4.md), [Task 5](task-5.md), [VPS](../deploy/vps.md), [Release](../deploy/releases.md), [Troubleshooting](../runbook/troubleshooting.md), [AWS đã nghiệm thu](../task3-aws-deployment.md).

Giới hạn phải công khai: Task 2 chưa hoàn thành; AWS demo cho mọi người xem/sửa dữ liệu nên chỉ dùng thông tin giả; metadata localStorage không đồng bộ; bỏ liên kết ảnh không xóa file. Khi triển khai VPS, phải backup ảnh riêng; rollback code không phục hồi localStorage. Rollback AWS index cần giữ assets và API tương thích.
