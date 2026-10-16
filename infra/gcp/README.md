# GCP Compute Engine

Project `gcp-project-511702`, zone `us-central1-a`. Terraform trong `infra/gcp/` quản lý VM `rental-hub-vm` (Ubuntu 24.04, `e2-micro`, disk 20 GB `pd-standard`), VPC, subnet, firewall, service account và ngoại lệ project policy cho public IPv4 của VM này.

Terraform state ở bucket GCS riêng tư, có versioning: `gs://rental-hub-tfstate-973198905935/gcp/production/default.tfstate`. File `backend.tf` được tạo cục bộ từ `backend.tf.example` và không được commit. Giới hạn quyền bucket cho operator đáng tin cậy; không đưa state, plan, credential hoặc SSH key vào Git.

## Kiểm tra hạ tầng

Đăng nhập gcloud và Application Default Credentials bằng trình duyệt khi cần. Từ repo root:

```powershell
gcloud auth login
gcloud auth application-default login
Copy-Item infra/gcp/backend.tf.example infra/gcp/backend.tf
terraform -chdir=infra/gcp init -reconfigure
terraform -chdir=infra/gcp fmt -check
terraform -chdir=infra/gcp validate
terraform -chdir=infra/gcp plan
```

Kiểm tra project, state và plan trước khi apply. Nếu state thiếu nhưng VM đã tồn tại, import tài nguyên đang chạy vào state; không chấp nhận plan tạo VM trùng, thay thế hoặc xóa VM ngoài ý muốn. Chỉ apply thay đổi hạ tầng sau khi review chi phí và plan.

## Deploy frontend

```powershell
powershell -ExecutionPolicy Bypass -File ops/gcp/deploy.ps1
```

Script yêu cầu working tree Git sạch, chạy `npm ci`, build frontend tại `.local/build/web/`, ghi commit Git và release ID vào `/release.json`, upload qua IAP, chuyển release Nginx, smoke test public HTTP và rollback nếu smoke thất bại. IP public là ephemeral, có thể đổi khi dừng VM.

Chỉ cổng HTTP 80 mở Internet; SSH 22 chỉ nhận dải IAP và OS Login được bật. Website chưa có domain/HTTPS, đăng nhập hoặc lưu dữ liệu chung. Upload ảnh bị tắt; CRUD lưu trong từng trình duyệt. Không nhập dữ liệu khách hàng thật hoặc credential qua HTTP.

## Gỡ hạ tầng

Sau khi đã phê duyệt xóa VM và boot disk:

```powershell
terraform -chdir=infra/gcp destroy
```

Bucket state không do Terraform này quản lý và vẫn được giữ lại. Chỉ xóa bucket sau khi đã sao lưu state và xác nhận không còn hạ tầng cần quản lý. VM, disk, public IPv4 và bucket có thể phát sinh phí khi còn tồn tại.
