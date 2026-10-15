# Task 3 — AWS S3 private + CloudFront bằng Terraform

Ngày triển khai: 13/10/2026. Account: `287872994400`. Region mặc định AWS CLI và hai bucket: `ap-southeast-2` (Sydney).

Trạng thái: **Task 3 hoàn thành**. Đã chạy lại script deploy sau khi dọn code và xác minh bản production qua URL AWS. Task 2 (VPS) và diễn tập rollback của Task 4 nằm ngoài lần nghiệm thu này.

Website: **https://d2pqq5rtvfmo3w.cloudfront.net**. CloudFront distribution: `E1V0VFFK749XB0`.

## Kiến trúc thực tế

```text
Browser --HTTPS--> CloudFront --HTTPS + OAC--> S3 website private
                       |
                       +--> CloudWatch metrics (us-east-1)
                       +--> standard access logs v2 --> S3 logs private (Sydney)
```

| Tài nguyên | Giá trị |
| --- | --- |
| Website bucket | `npt-room-finder-prod-website-287872994400` |
| Logs bucket | `npt-room-finder-prod-logs-287872994400` |
| OAC | `E2QYLDZS7M2BPH` |
| Cache policy | `6e278f8a-ebf8-4f23-b12c-758c95b38759` |
| Log delivery source | `npt-room-finder-prod` |
| Log delivery destination | `npt-room-finder-prod-s3` |
| Log delivery ID | `utz99FTIsl7CARbF` |

Dùng S3 REST origin, không bật S3 website hosting. Cả hai bucket bật toàn bộ Block Public Access, BucketOwnerEnforced và SSE-S3 (AES256). Website bucket bật Versioning; không có lifecycle xóa website. Bucket policy chỉ cấp quyền đọc object cho đúng CloudFront distribution qua OAC, và từ chối HTTP. Principal logs chỉ được ghi vào prefix của account, có ràng buộc source account và source ARN.

CloudFront redirect HTTP sang HTTPS, dùng certificate mặc định và hostname `cloudfront.net`. Không tạo Route 53 hoặc ACM. Distribution dùng toàn bộ edge locations, bật compression, HTTP/2 và HTTP/3, cùng managed SecurityHeadersPolicy.

SPA theo sơ đồ: custom error 403 và 404 trả `/index.html` với HTTP 200, error TTL 0. Cache policy có MinTTL 0 và tôn trọng Cache-Control từ S3: index revalidate; assets hash cache một năm; font/favicon cache một ngày.

**Giới hạn fallback:** file tĩnh không tồn tại cũng trả HTML 200. Khi debug lỗi JS/CSS, kiểm tra Content-Type và đường dẫn asset. Có thể chuyển sang viewer-request rewrite khi cần phân biệt lỗi file tĩnh với route SPA; chưa thêm CloudFront Function trong task này.

CRUD vẫn lưu ở localStorage theo browser/origin. Dữ liệu ở localhost/VPS không tự chuyển sang domain CloudFront; sử dụng dữ liệu demo khi đánh giá.

## Cấu trúc Terraform

Hạ tầng được quản lý bằng **Terraform** trong `infra/aws/`: `main.tf` nối ba module `storage`, `cdn`, `logging`; `monitoring.tf` cấu hình S3 request metrics, CloudWatch alarm và SNS topic policy; `locals.tf` chứa cấu hình chung; `versions.tf` cấu hình provider; `outputs.tf` trả URL và thông tin cho script deploy. `moved.tf` giữ ánh xạ còn áp dụng từ địa chỉ tài nguyên cũ; xem [cấu trúc](architecture.md). Provider AWS chính dùng Sydney, provider alias `logs` dùng `us-east-1`; policy của S3 logs bucket dùng provider Sydney trong module logging. Provider giới hạn account `287872994400`; `.terraform.lock.hcl` khóa phiên bản AWS provider. Không chứa credential; Terraform và AWS CLI dùng credential/profile đã đăng nhập trên máy.

Các tài nguyên đã tạo được import vào Terraform, không tạo lại bucket/distribution hoặc thay URL. `imports.tf.example` lưu các import block để phục hồi state nếu cần. Đây là cấu hình cho account và website này, không phải module nhiều môi trường.

Ngày 15/10/2026, state local bị thiếu và đã được phục hồi bằng import **19 tài nguyên đang tồn tại**, gồm SNS topic policy; không tạo lại bucket/distribution. Apply tiếp theo bật request metrics cho website bucket, thêm quyền `sns:Publish` cho CloudWatch trên topic `my_topic` và tạo alarm `npt-room-finder-prod-s3-5xx`. Plan sau đó cần được kiểm tra lại trước mỗi thay đổi.

## Đối chiếu yêu cầu Task 3

| Yêu cầu | Kết quả xác minh |
| --- | --- |
| Dịch vụ và quyền truy cập | S3 private, OAC ký SigV4, bucket policy giới hạn đúng distribution; Terraform plan không có thay đổi |
| Build/deploy production | Lint, 16 unit tests và typecheck/build qua; upload asset trước index, invalidation hoàn tất, script báo `Deployment verified` |
| Chính sách mạng phù hợp | Hai bucket bật toàn bộ Block Public Access, từ chối HTTP; S3 direct URL trả 403; kiến trúc này không dùng Security Group |
| Truy cập từ Internet | CloudFront `Deployed`; URL public HTTPS trả 200 và JavaScript đúng MIME type |
| Frontend routing | `/`, `/buildings`, `/rooms`, `/bookings` trả đúng HTML bản build; E2E kiểm tra reload và CRUD |
| Domain/HTTPS | Hostname mặc định CloudFront, certificate mặc định, redirect HTTP sang HTTPS |
| Logs và trạng thái | Delivery v2 hoạt động, S3 có access log gzip chứa dữ liệu, CloudWatch có sáu metrics mặc định |

## Quản lý hạ tầng bằng Terraform

Môi trường đã kiểm tra: Terraform 1.15.5, AWS provider 6.68.0.

```powershell
terraform '-chdir=infra/aws' init
terraform '-chdir=infra/aws' fmt -check -recursive
terraform '-chdir=infra/aws' validate
terraform '-chdir=infra/aws' test
terraform '-chdir=infra/aws' plan '-out=changes.tfplan'
# Đọc plan, rồi apply đúng plan đã kiểm tra.
terraform '-chdir=infra/aws' apply changes.tfplan
terraform '-chdir=infra/aws' output website_url
```

`terraform test` dùng mocked provider, không tạo tài nguyên AWS. Hạ tầng thay đổi qua Terraform; build và upload nội dung `.local/build/web/` dùng AWS CLI để giữ asset hash cũ và upload index cuối cùng.

**State local:** state vừa phục hồi nằm ở `infra/aws/terraform.tfstate`; giữ và sao lưu riêng cùng `.backup`. State, plan và `.terraform/` bị loại khỏi Git; lock file được giữ trong Git. Chưa tạo remote backend hoặc bucket thứ ba. Nếu chuyển máy hoặc làm theo nhóm, cần chuyển state có kiểm soát sang backend có locking. Không chạy hai lần Terraform apply/deploy đồng thời. Không dùng bản state cũ trước khi import để chạy `apply`: bản đó có thể vẫn quản lý Cognito và gây thay đổi ngoài ý muốn.

Nếu mất state trong khi các tài nguyên vẫn tồn tại, phục hồi bằng import, thay vì tạo mới:

```powershell
Copy-Item infra/aws/imports.tf.example infra/aws/imports.tf
terraform '-chdir=infra/aws' plan '-out=adopt.tfplan'
# Chỉ apply khi plan đúng với tài nguyên đang có và không thay thế bucket/distribution.
terraform '-chdir=infra/aws' apply adopt.tfplan
Remove-Item -LiteralPath infra/aws/imports.tf
```

Import blocks giữ ngoài cấu hình thường dùng để mocked tests không cố import tài nguyên thật. Mẫu hiện gồm 19 import blocks/instances, kể cả policy của SNS topic đang tồn tại. Buckets và distribution có `prevent_destroy`; buckets có `force_destroy=false`. Không chạy destroy để cập nhật website.

## Build và deploy lại

Chạy từ thư mục repository với Node.js 24, npm, PowerShell, Terraform và AWS CLI v2; Terraform state phải có outputs:

```powershell
aws sts get-caller-identity
powershell -NoProfile -ExecutionPolicy Bypass -File ops/aws/deploy-aws.ps1
```

Script lấy resource identifiers từ Terraform outputs, kiểm tra đúng account, bucket owner và CloudFront origin; chạy lint, unit tests và production build (bao gồm typecheck). Bất kỳ lệnh lỗi nào cũng dừng triển khai. Nếu build thất bại, script chưa upload file. Asset mới upload trước, giữ asset hash cũ, index upload cuối cùng; không dùng `sync --delete`. Script đợi distribution/invalidation, so sánh HTML của bốn route với bản build, và kiểm tra MIME type JavaScript.

Xem trước với `-WhatIf`: vẫn chạy quality gates và đọc AWS identity/config, nhưng không upload/invalidate.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ops/aws/deploy-aws.ps1 -WhatIf
$env:PLAYWRIGHT_BASE_URL = 'https://d2pqq5rtvfmo3w.cloudfront.net'
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

Playwright dùng browser context riêng; các thao tác CRUD thử nghiệm chỉ ghi localStorage của context đó. Nếu distribution mới tạo chưa resolve DNS trên máy, đợi DNS cập nhật rồi chạy lại; deployment status và invalidation completion không đảm bảo DNS cache của mọi máy đã cập nhật.

## Logs, metrics và lifecycle

```powershell
aws cloudfront get-distribution --id E1V0VFFK749XB0 --query 'Distribution.Status'
aws logs get-delivery --id utz99FTIsl7CARbF --region us-east-1
aws s3 ls s3://npt-room-finder-prod-logs-287872994400/AWSLogs/287872994400/CloudFront/ --recursive --region ap-southeast-2
aws cloudwatch list-metrics --namespace AWS/CloudFront --dimensions Name=DistributionId,Value=E1V0VFFK749XB0 --region us-east-1
```

CloudFront metrics nằm ở **N. Virginia**, namespace `AWS/CloudFront`, dimensions `DistributionId=E1V0VFFK749XB0` và `Region=Global`. Metrics mặc định gồm Requests, BytesDownloaded, BytesUploaded, TotalErrorRate, 4xxErrorRate và 5xxErrorRate. SNS topic hiện ở Sydney; SCP của account chặn SNS/EventBridge tại N. Virginia. Vì vậy alarm hiện tại theo dõi **S3 origin 5xx** ở Sydney, không theo dõi CloudFront 5xx. `CacheHitRate` thuộc additional metrics có phí và chưa bật. [AWS CloudFront metrics](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/monitoring-using-cloudwatch.html).

S3 request metrics được bật cho `EntireBucket` của website bucket. Alarm `AWS/S3 / 5xxErrors` phát cảnh báo khi có ít nhất một lỗi trong 5 phút, `treat_missing_data=notBreaching`, rồi gửi vào `arn:aws:sns:ap-southeast-2:287872994400:my_topic`. Topic đã có email subscription được xác nhận. Ngày 15/10/2026, thử chuyển alarm sang `ALARM` ghi nhận CloudWatch action gửi SNS thành công; alarm đã được đưa về `OK`. Request metrics có phí CloudWatch riêng và có thể mất khoảng 15 phút trước khi hiện dữ liệu đầu tiên. [AWS S3 request metrics](https://docs.aws.amazon.com/AmazonS3/latest/userguide/configure-request-metrics-bucket.html).

Logs v2 ở S3 dùng JSON, cookie logging tắt. Không cấu hình legacy logging trên distribution; v2 được quản lý bằng ba resource CloudWatch delivery riêng. S3 logs bucket không bật versioning để expiration thực sự xóa log, không chỉ tạo delete marker.

- Ngày 0–29: S3 Standard.
- Ngày 30: chuyển Standard-IA; mặc định chỉ file từ 128 KB trở lên được transition.
- Ngày 90: xóa mọi log, kể cả file nhỏ; expiration là rule riêng không lọc theo size.
- Hủy multipart upload chưa hoàn tất sau 7 ngày.

[AWS lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-general-considerations.html). Standard logs giao theo batch, thường trong một giờ và có thể trễ tới 24 giờ; không phải realtime logs. [AWS log timing](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/standard-logs-reference.html).

## Rollback và xử lý sự cố

Website bucket đã bật Versioning, script giữ asset hash cũ. Liệt kê version của `index.html`, tải version cần phục hồi rồi upload lại như một version mới; giữ metadata Cache-Control/Content-Type và invalidate `/*`:

```powershell
aws s3api list-object-versions --bucket npt-room-finder-prod-website-287872994400 --prefix index.html --region ap-southeast-2
# Thay VERSION_ID bằng version đã đối chiếu trước khi chạy.
aws s3api get-object --bucket npt-room-finder-prod-website-287872994400 --key index.html --version-id VERSION_ID restored-index.html --region ap-southeast-2
aws s3 cp restored-index.html s3://npt-room-finder-prod-website-287872994400/index.html --content-type 'text/html; charset=utf-8' --cache-control 'no-cache,max-age=0,must-revalidate' --region ap-southeast-2
aws cloudfront create-invalidation --distribution-id E1V0VFFK749XB0 --paths '/*'
```

Đây là rollback HTML/asset hash; khi thay đổi font/favicon cùng đường dẫn, cần phục hồi version tương ứng. Chưa diễn tập rollback trên website đang chạy. Không xóa version cũ hay asset cũ trong Task 3.

- S3 direct URL trả 403: đúng thiết kế private; truy cập qua CloudFront.
- CloudFront trả 403/HTML thay JS: kiểm tra object tồn tại, origin OAC và bucket policy ARN, sau đó invalidate.
- Refresh route: đối chiếu custom errors 403/404 và file index; không mở public bucket để chữa lỗi.
- Logs chưa xuất hiện: kiểm tra delivery ID, bucket policy và thời gian giao batch. Object 0 byte kết thúc bằng `/` chỉ là prefix marker, không chứng minh request log đã được giao.
- SCP explicit deny: xác minh region được Organization cho phép; IAM Allow không ghi đè SCP Deny.

Free Tier phụ thuộc eligibility/credit của account; S3 storage/request, CloudFront traffic/invalidation vượt allowance và log delivery có thể phát sinh phí. Website version cũ cũng chiếm storage. Không có EC2, RDS, NAT Gateway, Route 53, ACM hoặc GitHub Actions trong Task 3.
