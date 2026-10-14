# Task 3: đăng nhập Admin và tải ảnh trên AWS

Kiến trúc triển khai ngày 14/10/2026:

```text
Admin → Browser → CloudFront (HTTPS) → S3 website private (React build + /images)
            ↘ Cognito User Pool (đăng nhập)
              → Cognito Identity Pool (AWS credentials tạm thời)
              → S3 PUT /images/* (hai bản WebP 600px và 1200px)
```

CloudFront dùng OAC để đọc bucket. Bucket vẫn chặn public access và HTTP. Cognito User Pool ở gói Lite, chỉ cho Admin do người vận hành tạo; Identity Pool không cấp danh tính khách. IAM role của Admin chỉ có `s3:PutObject` dưới `images/*`; CORS của S3 chỉ cho `PUT` từ domain CloudFront. Website không dùng EC2, Lambda, API Gateway hay server chạy thường trực. Cognito phục vụ đăng nhập Admin, không tham gia luồng CloudFront phân phối nội dung.

Ứng dụng yêu cầu đăng nhập khi chạy bản AWS. Token và AWS credentials chỉ giữ trong bộ nhớ tab; reload yêu cầu đăng nhập lại. Sau khi chọn ảnh JPEG/PNG/WebP tối đa 10 MiB, trình duyệt kiểm tra chiều rộng từ 1200px, tối đa 20 MP, tạo WebP 600/1200 và tải trực tiếp lên S3. Metadata chỉ được lưu vào Zustand/localStorage sau khi cả hai PUT thành công. Ảnh có URL CloudFront `/images/...`; dữ liệu tòa nhà/phòng/booking vẫn chỉ nằm trong localStorage của trình duyệt, không đồng bộ giữa máy.

## Triển khai và kiểm tra

Từ repo root, dùng đúng account `287872994400` và Terraform state hiện có trong `infra/aws/`:

```powershell
terraform '-chdir=infra/aws' validate
terraform '-chdir=infra/aws' plan
terraform '-chdir=infra/aws' apply
node ops/aws/create-aws-admin.mjs # Chỉ chạy một lần để tạo tài khoản; file ở ~/.ssh/rental-hub-task3-admin.txt
git switch main
powershell -NoProfile -ExecutionPolicy Bypass -File ops/aws/deploy-main.ps1
$env:SITE_URL = 'https://d2pqq5rtvfmo3w.cloudfront.net'
$env:AWS_ADMIN_CREDENTIAL_FILE = Join-Path $HOME '.ssh/rental-hub-task3-admin.txt'
npx playwright test tests/e2e/aws-admin.spec.ts
Remove-Item Env:SITE_URL,Env:AWS_ADMIN_CREDENTIAL_FILE
```

Script deploy đọc Cognito IDs và bucket từ Terraform outputs, build với các biến `VITE_AWS_*` công khai, upload asset trước `index.html`, kiểm tra HTTPS/route rồi tự phục hồi index version cũ khi smoke thất bại. Không đặt mật khẩu vào `VITE_*`, Git hoặc Terraform state. `ops/aws/create-aws-admin.mjs` chỉ tạo mới; nếu file credential đã tồn tại, script dừng để tránh thay mật khẩu ngoài ý muốn.

Để trình bày cho mentor: mở URL, đăng nhập Admin, thêm tòa nhà/phòng rồi tải ảnh; mở ảnh 1200px và reload. Trong AWS Console, chỉ ra CloudFront distribution `E1V0VFFK749XB0`, website bucket private, Cognito User Pool/Identity Pool và IAM policy chỉ ghi `images/*`. Kiểm tra `terraform plan` không có thay đổi sau deploy. Rollback website bằng `ops/aws/deploy-aws.ps1 -RollbackVersionId <VersionId>`; ảnh đã tải lên nằm trong bucket versioned và không bị script deploy xóa.

Giới hạn: Cognito bảo vệ thao tác trên giao diện và quyền ghi S3, nhưng localStorage không phải kho dữ liệu dùng chung hay backend bảo mật. Đăng xuất khỏi tab không thu hồi ngay credentials AWS đã cấp (tối đa khoảng một giờ). Nếu PUT thứ hai lỗi, bản WebP đầu có thể tồn tại mà chưa được liên kết; cần cơ chế dọn ảnh khi chuyển sang dữ liệu tập trung. CloudFront hiện trả `index.html` HTTP 200 cả cho đường dẫn file không có do fallback SPA; kiểm tra MIME khi debug ảnh/JS. AWS có thể phát sinh phí S3, CloudFront và Cognito nếu vượt mức miễn phí của account.
