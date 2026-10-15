# Ảnh và dữ liệu chung trên AWS

CloudFront phục vụ React build và ảnh WebP từ S3 website bucket riêng của staging/production. Route `/api/*` chuyển tới API Gateway HTTP API và Lambda Node.js 24. Lambda kiểm tra entity, MIME, kích thước tối đa 4 MiB và nội dung ảnh; Sharp tạo hai bản 600/1200 px WebP chất lượng 80, bỏ metadata rồi ghi `images/{building|room}-image/{entityId}/{imageId}/{timestamp}-{uuid}_{size}.webp` lên S3. Ảnh được gắn vào metadata bằng một thao tác CRUD tiếp theo. Gỡ ảnh trong giao diện chỉ gỡ liên kết; ảnh không được xóa vật lý.

Lambda lưu tòa nhà, phòng và lịch đặt trong `estate.json` ở **data bucket riêng, chặn truy cập công khai và bật versioning**. GET trả snapshot và ETag. POST gửi action, input và ETag; Lambda áp dụng cùng quy tắc nghiệp vụ với bản local, dùng S3 conditional write để tránh ghi đè thay đổi đồng thời. Khi hai người cùng sửa, người đến sau nhận 409 và dữ liệu mới; họ cần thử lại. Tải lại trang sẽ đọc dữ liệu chung từ AWS.

Đây là **demo công khai không xác thực**: bất kỳ người truy cập nào cũng xem, thêm, sửa, xóa dữ liệu và tải ảnh. Lịch đặt chứa tên/số điện thoại; chỉ dùng dữ liệu giả. API Gateway giới hạn trung bình 2 request/giây, burst 10; Lambda concurrency 2. Không dùng cho dữ liệu thật trước khi thêm đăng nhập, phân quyền và giới hạn lưu trữ.

Local/VPS vẫn lưu CRUD trong localStorage và dùng media API Node/Sharp, tối đa 10 MiB. Dữ liệu local cũ không tự chuyển lên AWS. Deploy AWS build Lambda trên Linux rồi upload assets web trước `index.html`; script kiểm tra API trước khi chuyển index. Rollback hiện khôi phục `index.html` từ S3 VersionId; dữ liệu chung và ảnh giữ nguyên.
