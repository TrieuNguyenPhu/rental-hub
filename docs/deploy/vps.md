# Task 2 — VPS Linux độc lập

AWS Task 3 đã hoàn tất và nằm ngoài quy trình này. Task 2 hiện được chạy thử trên EC2 với Terraform riêng; xem [demo EC2](../../infra/ec2/README.md). Tài liệu dưới đây là hướng dẫn nếu triển khai một VPS Linux khác sau này.

## Điều kiện thực hiện

Chưa có VPS ngoài AWS tại thời điểm 2026-10-14. Các bước dưới đây là runbook VPS, không phải bằng chứng đã triển khai trên nhà cung cấp VPS. EC2 demo dùng AWS Free Plan credit, không phải Always Free VPS.

Oracle có [Always Free compute](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), nhưng cần tài khoản được xác minh, có thể thiếu capacity và có thể thu hồi máy idle. Người dùng tự hoàn tất đăng ký/xác minh thẻ. Chọn tài nguyên có nhãn Always Free theo quota hiện trên console; không mặc định mọi VM là miễn phí. Ubuntu WSL dùng cho thử nghiệm tại máy, chưa đáp ứng điều kiện VPS public.

Cần IP/SSH alias, user có sudo, public key của deploy user, địa chỉ IP quản trị; domain là tùy chọn. Không gửi private key/mật khẩu vào chat hoặc Git. Với nhà cung cấp có firewall riêng, cho phép TCP 22 từ IP quản trị và 80/443 từ Internet; không mở 3001, 3002, 8081 hoặc Vite.

## Chuẩn bị Ubuntu 24.04

Trước khi thay đổi: `cat /etc/os-release`, `uname -m`, `df -h`, `free -h`, `ss -lntp`, kiểm tra website/unit/Nginx đang có. Các lệnh sau dành cho VPS mới; không ghi đè site đang phục vụ workload khác.

```bash
sudo apt-get update
sudo apt-get install -y nginx git curl xz-utils ca-certificates ufw acl apache2-utils
sudo adduser --disabled-password --gecos '' deploy
sudo install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
# Chỉ sao chép authorized_keys đã kiểm chứng của tài khoản SSH hiện tại.
sudo install -o deploy -g deploy -m 600 ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
sudo groupadd --system rental-hub
sudo useradd --system --gid rental-hub --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin rental-hub-media
sudo usermod -aG rental-hub deploy
```

Cài Node 24.18.0, kiểm tra checksum từ nodejs.org. Lệnh chạy ở thư mục tạm riêng; chọn đúng kiến trúc:

```bash
case "$(uname -m)" in x86_64) arch=x64;; aarch64) arch=arm64;; *) exit 1;; esac
node_archive="node-v24.18.0-linux-$arch"
mkdir -p ~/node-install && cd ~/node-install
curl -fsSLO "https://nodejs.org/dist/v24.18.0/$node_archive.tar.xz"
curl -fsSLO https://nodejs.org/dist/v24.18.0/SHASUMS256.txt
grep " $node_archive.tar.xz$" SHASUMS256.txt | sha256sum -c -
# Chỉ tiếp tục khi checksum OK.
sudo tar -xJf "$node_archive.tar.xz" -C /opt
sudo ln -s "/opt/$node_archive/bin/node" /usr/local/bin/node
sudo ln -s "/opt/$node_archive/bin/npm" /usr/local/bin/npm
node --version
npm --version
```

Giữ SSH session hiện tại; mở session thứ hai bằng key với user deploy trước khi harden SSH/UFW. Điền IP quản trị thật trước khi chạy; không tắt password/root login trước khi kiểm chứng đường cứu hộ.

```bash
sudo ufw allow from ADMIN_IP to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

## Filesystem và quyền

```bash
sudo install -d -o deploy -g rental-hub -m 755 /srv/rental-hub /srv/rental-hub/releases /srv/rental-hub/shared /srv/rental-hub/shared/assets
sudo install -d -o rental-hub-media -g rental-hub -m 2770 /srv/rental-hub/shared/images /srv/rental-hub/shared/tmp
# Nginx đọc ảnh; không cấp quyền ghi cho www-data.
sudo setfacl -m u:www-data:r-x -m d:u:www-data:r-x /srv/rental-hub/shared/images
sudo install -d -o root -g rental-hub -m 750 /etc/rental-hub
# Chỉ cho Nginx đi qua thư mục để đọc đúng file htpasswd có group www-data.
sudo setfacl -m u:www-data:--x /etc/rental-hub
```

Đăng nhập lại deploy để nhận group mới. Clone repository vào `/home/deploy/rental-hub-source`; source phải chứa commit triển khai trên remote. Templates ở `deploy/` cần được review và thay `example.invalid` bằng origin thật.

```bash
git clone https://github.com/TrieuNguyenPhu/rental-hub.git ~/rental-hub-source
cd ~/rental-hub-source
sudo install -o root -g rental-hub -m 640 deploy/env/media.env.example /etc/rental-hub/media.env
sudo install -o deploy -g deploy -m 600 deploy/env/deploy.env.example /etc/rental-hub/deploy.env
```

Trong cả hai env, đặt cùng origin (`http://IP` nếu chưa có domain, hoặc `https://domain`); không có slash cuối. Với HTTP public, đặt `MEDIA_READ_ONLY=true`: health/frontend hoạt động, upload bị chặn. Chỉ đặt `MEDIA_READ_ONLY=false` sau khi bật HTTPS. Sửa file bằng sudo/editor, không đặt secret vào `VITE_*`. Template media chỉ chứa config, còn mật khẩu upload ở file riêng.

## Nginx và systemd

```bash
sudo install -m 644 deploy/nginx/rental-hub-locations.conf /etc/nginx/snippets/rental-hub-locations.conf
sudo install -m 644 deploy/nginx/rental-hub.conf /etc/nginx/conf.d/rental-hub.conf
sudo install -m 644 deploy/nginx/rental-hub-staging.conf /etc/nginx/conf.d/rental-hub-staging.conf
sudo install -m 644 deploy/systemd/rental-hub-media.service /etc/systemd/system/rental-hub-media.service
sudo systemctl daemon-reload
sudo systemctl enable rental-hub-media
sudo nginx -t
# Chỉ reload khi nginx -t thành công; giải quyết default site/server_name bị trùng trước.
sudo systemctl reload nginx
```

User deploy cần sudo giới hạn cho đúng unit. Dùng `sudo visudo -f /etc/sudoers.d/rental-hub-deploy`, xác minh đường dẫn `command -v systemctl` rồi thêm:

```sudoers
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart rental-hub-media, /usr/bin/systemctl stop rental-hub-media
```

Không cấp sudo Bash, node, editor hoặc wildcard systemctl. Service chỉ chạy bằng user media; Node lắng nghe loopback. Candidate chạy read-only trên 3002 qua Nginx 8081 loopback. `sudo nginx -t` cần chạy lại mỗi khi thay template, không cần reload Nginx mỗi lần đổi symlink release.

Deploy bằng full SHA đã push:

```bash
bash scripts/deploy.sh FULL_40_HEX_COMMIT /etc/rental-hub/deploy.env
systemctl status rental-hub-media --no-pager
sudo journalctl -u rental-hub-media -n 50 --no-pager
ss -lntp
bash scripts/smoke.sh http://ACTUAL_IP FULL_40_HEX_COMMIT
```

Xác minh từ một mạng ngoài VPS: trang chủ, `/rooms`, reload, CRUD, asset JS đúng MIME; API port 3001/3002 và candidate 8081 không truy cập được. Đối chiếu [release runbook](releases.md) và [Task 2 acceptance](../acceptance/task-2.md).

## HTTPS và upload

Khi có domain: DNS A trỏ VPS, chỉ giữ AAAA khi VPS thực sự phục vụ IPv6. Cài `certbot`; lấy chứng chỉ bằng HTTP webroot `/var/www/letsencrypt` (thêm location `/.well-known/acme-challenge/` trước). Cấu hình theo `deploy/nginx/rental-hub-https.conf.example`; thay domain/đường cert, đổi HTTP sang redirect ngoại trừ ACME và `/api/images` (vẫn 403).

```bash
sudo apt-get install -y certbot
sudo install -d -m 755 /var/www/letsencrypt
sudo certbot certonly --webroot -w /var/www/letsencrypt -d ACTUAL_DOMAIN
sudo htpasswd -c /etc/rental-hub/upload.htpasswd upload-admin
sudo chown root:www-data /etc/rental-hub/upload.htpasswd
sudo chmod 640 /etc/rental-hub/upload.htpasswd
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
```

`htpasswd` hỏi mật khẩu tương tác; không truyền password qua command line. Đổi SITE_URL và SITE_ORIGIN sang HTTPS, đặt `MEDIA_READ_ONLY=false` trước khi restart media. Kiểm tra `sudo -u www-data test -r /etc/rental-hub/upload.htpasswd`. Xác minh certificate chain/hostname/expiry, redirect và renewal. Upload chưa auth phải 401, sai Origin phải 403, quá 10 MiB phải 413; thử UI ảnh building/room bằng tài khoản demo.

Nếu chưa có domain/HTTPS, chỉ nghiệm thu frontend HTTP. API có thể kiểm thử qua SSH tunnel loopback nhưng **không đánh dấu upload Internet đạt**. Không gửi Basic Auth qua HTTP public. Backup shared/images riêng và xuất localStorage từ trình duyệt; rollback code không khôi phục metadata browser.
