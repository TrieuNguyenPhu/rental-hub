# CI/CD cho develop và main

`develop` là nhánh demo thay đổi. Tạo pull request từ `develop` vào `main`; `main` là nguồn phát hành production cho cả EC2 Task 2 và S3/CloudFront Task 3. Mỗi môi trường vẫn có storage, origin và quy trình rollback riêng.

GitHub Actions `CI` chạy khi push/PR vào `develop` hoặc `main`: Node 24, `npm ci`, lint, typecheck, unit tests, build frontend/media, `npm audit` production dependencies, release/rollback fixtures và Playwright local. Workflow chỉ có quyền đọc repository; không có AWS key, SSH key hoặc mật khẩu upload.

AWS Organizations hiện từ chối `iam:ListOpenIDConnectProviders` bằng Service Control Policy, nên chưa thể cấu hình GitHub OIDC một cách có kiểm chứng. Không đưa access key IAM hiện tại lên GitHub để né giới hạn này. CD dùng một lệnh từ máy quản trị đang có AWS CLI, Terraform state Task 3, GitHub CLI và SSH key EC2. Đây là phát hành thủ công sau CI, chưa phải tự động deploy khi merge.

Sau khi CI của commit `main` hoàn tất thành công:

```powershell
git switch main
git pull --ff-only origin main
powershell -NoProfile -ExecutionPolicy Bypass -File ops/aws/deploy-main.ps1 -WhatIf
powershell -NoProfile -ExecutionPolicy Bypass -File ops/aws/deploy-main.ps1
```

Script từ chối working tree bẩn, SHA khác `origin/main`, CI push chưa đạt, account AWS khác, EC2 không đúng tag/trạng thái, thiếu key hoặc release EC2 không xác thực. Nó chạy `npm ci` trên máy quản trị trước khi đổi production. EC2 build/test candidate trước khi đổi symlink. Sau đó script AWS giữ asset cũ, upload index cuối cùng, chờ CloudFront invalidation và smoke. Nếu AWS deploy lỗi, script AWS tự khôi phục index và lệnh chung rollback EC2 về SHA trước đó. Nếu cần rollback thủ công, dùng `ops/release/rollback.sh` trên EC2 và `ops/aws/deploy-aws.ps1 -RollbackVersionId <ID>` cho S3/CloudFront; kiểm tra lại URL sau mỗi bước.

HTML trên CloudFront có `<meta name="release-sha" content="...">` để đối chiếu với `/release.json` trên EC2 và `main` của GitHub. Khi rollback S3, marker trở về phiên bản cũ cùng với index.

Smoke HTTP sau invalidation thử lại lỗi kết nối tối đa 6 lần, cách nhau 5 giây; lỗi nội dung hoặc MIME vẫn dừng phát hành và khôi phục index trước đó.

Docker/Kubernetes/Argo CD/Cosign không được thêm: frontend là static build trên S3, media là một systemd service trên EC2, không có container registry hay cluster. Terraform tiếp tục quản lý tài nguyên hiện có, không chạy apply trong CI. CloudWatch/S3 logs, journalctl và Nginx log dùng để chẩn đoán sau phát hành.
