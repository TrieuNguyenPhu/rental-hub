# Xây dựng và triển khai website quản lý bất động sản trên VPS và AWS

## 1. Mục tiêu

Tự xây dựng một website quản lý bất động sản đơn giản bằng ReactJS, TypeScript và Zustand. Sau đó build ứng dụng và triển khai lên hai môi trường: VPS và AWS.

Yêu cầu tập trung vào khả năng cấu hình server, triển khai ứng dụng, quản lý phiên bản, bảo mật cơ bản và xử lý sự cố.

## 2. Công nghệ yêu cầu

- ReactJS
- TypeScript
- Zustand
- Git
- Linux
- VPS và AWS

Có thể sử dụng Vite, React Router, Nginx, Docker, GitHub Actions hoặc GitLab CI/CD.

## 3. Task 1 — Xây dựng website quản lý bất động sản

### Quản lý tòa nhà

- Hiển thị danh sách tòa nhà.
- Thêm, sửa, xóa tòa nhà.
- Tìm kiếm theo tên.
- Thông tin gồm tên, địa chỉ, tỉnh/thành phố, số tầng và trạng thái.

### Quản lý phòng

- Hiển thị danh sách phòng.
- Thêm, sửa, xóa phòng.
- Liên kết phòng với tòa nhà.
- Lọc theo tòa nhà và trạng thái.
- Thông tin gồm số phòng, tầng, diện tích, giá thuê và trạng thái.

### Quản lý lịch đặt phòng

- Hiển thị danh sách lịch đặt.
- Thêm, sửa và hủy lịch đặt.
- Nhập thông tin khách hàng, phòng, ngày nhận và ngày trả.
- Kiểm tra ngày trả phòng phải sau ngày nhận phòng.
- Không cho phép tạo lịch trùng thời gian đối với cùng một phòng.

### Yêu cầu kỹ thuật

- Sử dụng TypeScript định nghĩa kiểu dữ liệu.
- Sử dụng Zustand quản lý state.
- Có thể sử dụng localStorage để lưu dữ liệu.
- Giao diện đơn giản, không yêu cầu thiết kế phức tạp.
- Các chức năng chính phải hoạt động trước khi deploy.

## 4. Task 2 — Deploy website lên VPS

Tự lựa chọn và thực hiện phương án triển khai trên VPS Linux.

Yêu cầu:

- Kết nối VPS qua SSH.
- Cài đặt và cấu hình môi trường cần thiết.
- Đưa source code lên server.
- Thực hiện production build.
- Cấu hình Nginx hoặc web server tương đương.
- Cấu hình firewall và các port cần thiết.
- Đảm bảo website truy cập được từ bên ngoài.
- Đảm bảo refresh trang con không bị lỗi 404.
- Cấu hình domain và HTTPS nếu có domain.
- Kiểm tra log và xử lý các lỗi phát sinh.

## 5. Task 3 — Deploy website lên AWS

Tự lựa chọn dịch vụ AWS phù hợp và triển khai website độc lập với môi trường VPS.

Có thể lựa chọn:

- EC2 kết hợp Nginx.
- S3 kết hợp CloudFront để phục vụ frontend tĩnh.
- Hoặc một kiến trúc AWS phù hợp khác và giải thích được lựa chọn của mình khi demo.

Yêu cầu:

- Cấu hình dịch vụ và quyền truy cập cần thiết.
- Build và triển khai phiên bản production.
- Cấu hình network, security group hoặc chính sách truy cập phù hợp với kiến trúc.
- Đảm bảo website truy cập được từ bên ngoài.
- Xử lý routing phía frontend.
- Cấu hình domain và HTTPS nếu có điều kiện.
- Kiểm tra log, trạng thái dịch vụ và xử lý sự cố.

## 6. Task 4 — Quản lý và cập nhật phiên bản

Thực hiện trên cả VPS và AWS:

- Đưa source code lên Git repository.
- Thực hiện cập nhật phiên bản mới sau khi thay đổi code.
- Có quy trình build và deploy có thể lặp lại.
- Có phương án rollback khi phiên bản mới gặp lỗi.
- Ưu tiên tự động hóa bằng shell script hoặc CI/CD.
- Đảm bảo bản deploy đang hoạt động không bị thay thế bởi bản build thất bại.

## 7. Task 5 — Kiểm thử và xử lý sự cố

Người đánh giá có thể yêu cầu xử lý một số tình huống:

- Website không truy cập được.
- Nginx trả về lỗi 403, 404 hoặc 502.
- Build thành công nhưng website không hoạt động đúng.
- Refresh trang con bị lỗi.
- Cấu hình port hoặc firewall sai.
- Domain hoặc HTTPS không hoạt động.
- Phiên bản mới bị lỗi và cần rollback.

## 8. Điều kiện hoàn thành

- Website có đầy đủ chức năng CRUD cơ bản.
- Website được triển khai thành công trên cả VPS và AWS.
- Người dùng có thể truy cập website từ bên ngoài.
- Có thể cập nhật phiên bản mới sau khi thay đổi code.
- Có phương án rollback khi deploy lỗi.
