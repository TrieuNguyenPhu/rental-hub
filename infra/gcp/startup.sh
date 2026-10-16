#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx
install -d -m 755 /srv/rental-hub/releases
rm -f /etc/nginx/sites-enabled/default
cat >/etc/nginx/sites-available/rental-hub <<'NGINX'
server {
    listen 80 default_server;
    server_name _;
    root /srv/rental-hub/current;
    index index.html;
    add_header X-Content-Type-Options nosniff always;
    location = /api/images { return 403; }
    location ^~ /api/ { return 404; }
    location ^~ /images/ { return 404; }
    location = /release.json { add_header Cache-Control "no-store"; }
    location ^~ /assets/ { try_files $uri =404; }
    location / { try_files $uri $uri/ /index.html; }
}
NGINX
ln -sfn /etc/nginx/sites-available/rental-hub /etc/nginx/sites-enabled/rental-hub
nginx -t
systemctl enable --now nginx
systemctl reload nginx
