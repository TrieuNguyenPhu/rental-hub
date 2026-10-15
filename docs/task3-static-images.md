# Ảnh trên bản AWS tĩnh

Sau khi bỏ Cognito, bản AWS chỉ chạy React build trên S3 private qua CloudFront. Không có dịch vụ ghi ảnh từ trình duyệt. `ImageUploader` vẫn hiển thị ảnh đã được lưu trong metadata nhưng ẩn input upload khi `uploadImage` là `null`. Local/VPS tiếp tục dùng media API Node/Sharp để tải ảnh.

CRUD trên bản AWS lưu ở `localStorage` của từng trình duyệt. Không có đăng nhập hoặc dữ liệu dùng chung; bất kỳ ai mở website cũng có thể thay đổi dữ liệu trong trình duyệt của chính họ. Ảnh đã nằm trong S3 vẫn được CloudFront phân phối, nhưng ảnh không được tự đồng bộ giữa các máy vì metadata không có backend.

Deploy bằng `ops/aws/deploy-aws.ps1`, script đặt `VITE_STATIC_HOSTING=true` khi build. Script lấy bucket/distribution từ Terraform outputs, upload asset trước `index.html`, kiểm tra các route và có thể rollback index theo VersionId. Xem [hướng dẫn triển khai](task3-aws-deployment.md).
