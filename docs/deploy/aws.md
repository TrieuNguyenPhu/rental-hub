# AWS deployment

Production Terraform ở `infra/aws/`, account `287872994400`, region `ap-southeast-2`. URL được cấu hình qua CloudFront: `https://d2pqq5rtvfmo3w.cloudfront.net`. Staging có Terraform riêng tại `infra/aws/staging/`. Không dùng state của môi trường này cho môi trường kia.

CloudFront phục vụ frontend và ảnh WebP từ S3 private qua OAC; `/api/*` đi tới API Gateway và Lambda. Lambda lưu `estate.json` trong data bucket private, dùng ETag và S3 conditional write để phát hiện ghi đè đồng thời. Upload tối đa 4 MiB; Sharp tạo ảnh WebP 600/1200 px. Gỡ ảnh khỏi giao diện chỉ gỡ liên kết, không xóa object S3.

**Giới hạn dữ liệu:** API hiện chưa có đăng nhập hoặc phân quyền. Bất kỳ người truy cập nào cũng có thể đọc/sửa dữ liệu và upload ảnh. Chỉ dùng dữ liệu giả; không nhập thông tin khách hàng thật. Local/VPS dùng dữ liệu trình duyệt và không tự đồng bộ với AWS.

CloudFront chuyển HTTP sang HTTPS. SPA fallback đổi 403/404 thành `index.html` 200, kể cả với asset không tồn tại; khi trang trắng, kiểm tra Content-Type và đường dẫn JS/CSS. Bucket website/data/logs chặn public access. Chi tiết tài nguyên và ID hiện hành lấy từ `terraform -chdir=infra/aws output -json deployment` sau khi khởi tạo đúng state.

## Terraform và state

State production đang lưu cục bộ tại `infra/aws/terraform.tfstate`; staging có state riêng. State, backup, plan và credential không được commit. Sao lưu state trước khi thay đổi, chỉ cho một operator chạy Terraform tại một thời điểm. Nếu state thiếu hoặc không khớp tài nguyên hiện có, dừng lại và import; không chạy apply để tạo lại bucket hoặc distribution. `infra/aws/imports.tf.example` chứa mẫu import cho các tài nguyên production.

```powershell
terraform '-chdir=infra/aws' init
terraform '-chdir=infra/aws' fmt -check -recursive
terraform '-chdir=infra/aws' validate
terraform '-chdir=infra/aws' test
terraform '-chdir=infra/aws' plan '-out=changes.tfplan'
# Chỉ apply plan đã kiểm tra và được phê duyệt.
terraform '-chdir=infra/aws' apply changes.tfplan
```

`terraform test` dùng mock, không tạo tài nguyên AWS. Bucket có `prevent_destroy` và `force_destroy=false`. Không dùng `terraform destroy` để cập nhật website. Nếu phải phục hồi state, kiểm tra `imports.tf.example`, tạo file import cục bộ rồi review plan trước khi apply; không đưa file import hoặc state vào Git.

## Phát hành và rollback

CI ở [.github/workflows/ci.yml](../../.github/workflows/ci.yml) deploy staging sau khi push `develop`; production sau khi push `main` và được duyệt trong GitHub Environment. Xem [CI/CD](ci-cd.md). Deploy thủ công trên Linux x86_64 cần Node.js 24, npm, PowerShell Core, AWS CLI và quyền đúng account:

```powershell
pwsh ./ops/aws/deploy-aws.ps1 -WhatIf
pwsh ./ops/aws/deploy-aws.ps1 -Confirm:$false
```

Script kiểm tra account, bucket và CloudFront origin; chạy lint/test/build, cập nhật Lambda, kiểm tra API, upload asset trước `index.html`, chờ invalidation và smoke test. Không dùng `sync --delete`. `-WhatIf` vẫn chạy kiểm tra và đọc cấu hình AWS nhưng không upload.

Để rollback frontend, chọn VersionId tốt của `index.html` trong website bucket rồi chạy:

```powershell
aws s3api list-object-versions --bucket npt-room-finder-prod-website-287872994400 --prefix index.html --region ap-southeast-2
pwsh ./ops/aws/deploy-aws.ps1 -RollbackVersionId 'VERSION_ID' -Confirm:$false
```

Rollback chỉ đổi index và hashed assets; metadata, ảnh và Lambda không được khôi phục. Giữ asset cũ và tương thích API với frontend cũ. Nếu đổi font/favicon cùng URL, cần quản lý version của chúng riêng. Script có thể phục hồi index trước đó khi smoke thất bại. Không chạy deploy đồng thời từ hai máy vì lock chỉ cục bộ.

## Theo dõi và tài nguyên cũ

CloudFront metrics và log delivery ở `us-east-1`; S3 request metrics, alarm S3 5xx và SNS topic ở Sydney. Access logs nằm trong logs bucket, được chuyển sang Standard-IA sau 30 ngày và xóa sau 90 ngày. Theo dõi storage/request, CloudFront traffic, CloudWatch metrics và các phiên bản S3 cũ vì có thể phát sinh phí. Xem [runbook sự cố](../runbook/troubleshooting.md).

EC2 thử nghiệm `i-0ece2455235401517` từng được sử dụng ngoài Terraform production này. Kiểm tra trạng thái và billing của nó trong AWS trước khi quyết định dọn; không xóa instance hoặc volume khi chưa xác minh dữ liệu cần giữ.
