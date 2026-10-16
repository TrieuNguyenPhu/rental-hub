# Chẩn đoán và phục hồi

Luôn ghi thời gian, URL, triệu chứng và thay đổi gần nhất. VPS lấy SHA từ `/release.json` và `/api/health`; GCP lấy release ID từ `/release.json` (trường `commit` có sau lần deploy bằng script mới); AWS lấy SHA từ thẻ `release-sha` trong HTML trang chủ. AWS không phục vụ `/release.json`. Giữ SSH/recovery console. Không ghi Authorization, private key hoặc dữ liệu khách thật vào log. Trước sửa Nginx, backup file cấu hình; chỉ reload khi `nginx -t` thành công.

| Triệu chứng | Lệnh/quan sát để tìm nguyên nhân | Khắc phục và kiểm chứng |
|---|---|---|
| Timeout/connection refused | `getent ahosts DOMAIN`, `curl -v --connect-timeout 5 URL`, `ss -lntp`, `sudo ufw status verbose`, firewall nhà cung cấp, `systemctl status nginx` | Sửa DNS/port/rule/service theo tầng đang lỗi; giữ SSH. Kiểm tra bằng mạng bên ngoài, không chỉ curl localhost. |
| Nginx 403 | `sudo tail -n 50 /var/log/nginx/rental-hub.error.log`, `namei -l /srv/rental-hub/current/dist/index.html`, `getfacl` | Sửa owner/group/traverse/read hẹp; không chmod 777. Phân biệt directory listing bị cấm và upload HTTP cố ý 403. |
| Upload 401/403 | 401: Basic Auth chưa đúng. 403: request HTTP hoặc Origin khác SITE_ORIGIN | Dùng HTTPS/auth đúng và origin chính xác; không bỏ auth/CORS để chữa lỗi. |
| Refresh `/rooms` trả 404 | `sudo nginx -T`, symlink current, root và `try_files` | Fallback chỉ route ứng dụng về index; reload `/rooms` trên browser. `/assets/missing.js` và `/images/missing.webp` vẫn 404. |
| JS trả HTML hoặc trang trắng | Browser Console/Network, JS MIME, path `/assets/`, phiên bản theo môi trường ở trên, cache | Kiểm tra alias/assets hash và Vite base. Rollback bản tốt khi thiếu bundle; không ép mọi 404 thành 200. |
| `/api/health` 502 nhưng trang chủ 200 | `systemctl status rental-hub-media`, `sudo journalctl -u rental-hub-media -n 50`, `ss -lntp`, `curl http://127.0.0.1:3001/api/health` | Sửa unit/Node/env/quyền storage/port; restart, kiểm tra health đúng SHA rồi upload. Không proxy frontend qua Node để chữa lỗi media. |
| Health 503/upload 507 | `df -h`, `df -i`, `namei -l shared/images`, journal | Phục hồi dung lượng/quyền theo nguồn gây đầy; không xóa ảnh người dùng. Upload lỗi không được để lại một nửa cặp ảnh. |
| Upload 413/415/422/429 | Content-Length, MIME, kích thước pixel, thông báo UI, Nginx rate limit | Tối đa 10 MiB/20 MP; JPEG/PNG/WebP tĩnh, width sau EXIF ít nhất 1200. Chờ rate/busy giảm rồi thử lại. Không nâng limit để che lỗi input. |
| Sai domain/HTTPS | `getent ahosts DOMAIN`, `openssl s_client -connect DOMAIN:443 -servername DOMAIN`, `sudo certbot certificates`, `sudo certbot renew --dry-run` | Sửa A/AAAA/server_name/chain/expiry/clock/443. Không bỏ kiểm tra TLS của production. |
| Build/candidate fail | Log BUILD, `candidate-media.log`, Nginx candidate log, disk và lock | current phải vẫn là bản cũ. Sửa lỗi rồi build commit mới. Không sửa source trong release hoàn chỉnh. |
| `RECOVERY FAILED` | `readlink -f /srv/rental-hub/current`, SHA manifest, unit/env/port và public smoke | Khôi phục điều kiện runtime/storage trước, chạy rollback SHA tốt. Không chỉ đổi symlink rồi tuyên bố đã khỏe. |
| AWS lỗi | CloudFront status/cache/invalidation, S3 object/version và IAM/OAC, Terraform outputs | Dùng [runbook AWS](../deploy/aws.md) và AWS index rollback. Không sửa Nginx/UFW/VPS để chữa AWS S3/CloudFront. |
