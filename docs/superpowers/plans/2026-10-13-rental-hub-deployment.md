# VPS và AWS — Task 2–3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hai website production truy cập bên ngoài độc lập, có routing, ảnh, quyền/network phù hợp và evidence vận hành.

**Architecture:** Baseline Nginx phục vụ dist/assets/images và proxy API loopback; media process qua systemd; release/shared directories giống nhau trên VPS và EC2. AWS đã dùng S3/CloudFront phải giữ hoặc có quyết định chuyển rõ trước mutation.

**Tech Stack:** Ubuntu 24.04 LTS, Node.js 24 LTS, Nginx, systemd, SSH, UFW, AWS EC2/EBS/Security Group, ACME khi có domain.

**Spec:** [Thiết kế §6–§8](../specs/2026-10-13-rental-hub-design.md).

## Global Constraints

- Tuân theo [Global Constraints tổng](2026-10-13-rental-hub.md#global-constraints).
- Không có credential/host/domain thật trong kế hoạch. Điền config thực khi được phép triển khai; không log hoặc commit secret.
- Task 3 đã xong: nghiệm thu/tích hợp trước, không tự dựng EC2 mới hoặc xóa S3/CloudFront đã có.
- Service loopback3001; public80/443; SSH22 chỉ IP quản trị; không mở Vite hoặc API port Internet.
- Release/shared roots đúng spec §6; ảnh/hashed assets ngoài release; không `chmod777` hoặc chạy media root.
- HTTP có thể nghiệm thu frontend nếu thiếu domain. Upload Internet không được nghiệm thu trước HTTPS + Basic Auth.

## Review Focus

- UFW/SG lock SSH: 2.1/3.1 giữ session cứu hộ và xác minh session mới.
- SPA fallback nuốt missing image/asset: 2.2/3.2.
- API unauthorized/Origin sai hoặc port public: 2.3/3.2.
- AAAA sai/cert renew thất bại: 2.3/3.2.
- AWS phụ thuộc VPS hoặc EBS termination xóa ảnh: 3.1/3.2.

## Files và config mục tiêu

- `deploy/nginx/rental-hub.conf`: static, routing, api proxy, cache và limits.
- `deploy/systemd/rental-hub-media.service`: process non-root, config environment file.
- `deploy/env/media.env.example`: tên biến, không secret; roots theo spec.
- `docs/deploy/vps.md`, `docs/deploy/aws.md`: bước tạo/cấu hình, evidence và teardown resources đã tạo cho bài.
- `docs/acceptance/task-2.md`, `docs/acceptance/task-3.md`: checklist/commit/SHA/URL/checks.
- Paths host: `/srv/rental-hub`, `/etc/rental-hub`, `/var/log/nginx`, unit `rental-hub-media`.

### Task 2.1: VPS Linux, SSH và quyền filesystem

**Files:** `docs/deploy/vps.md`, `deploy/env/media.env.example`; server config ngoài Git.

**Interfaces:** Consumes VPS IP/SSH key từ người dùng và source remote; produces SSH deploy account + Node/npm/Nginx + directories + firewall baseline cho2.2. Không tạo/mua VPS hoặc nhận secret qua tài liệu.

- [ ] **Step 1 — Preflight evidence:** SSH vào VPS; ghi distro, architecture, disk/RAM bằng `cat /etc/os-release`, `uname -m`, `df -h`, `free -h`; kiểm tra site/process đang có để không ghi đè workload khác. Mục tiêu baseline Ubuntu24.04; distro khác phải điều chỉnh package/firewall tương ứng.
- [ ] **Step 2 — Test điều kiện cần:** non-root deploy account login key thành công, có sudo tối thiểu để quản lý unit/template; `node --version`, `npm --version`, `nginx -v`, `git --version`; thiếu runtime thì bước này chưa đạt.
- [ ] **Step 3 — Cấu hình:** cài runtime Node24 và Nginx từ nguồn tin cậy; tạo deploy/media users, releases/shared/assets/shared/images/shared/tmp và /etc/rental-hub; media ghi images/tmp, Nginx đọc images/assets/dist, deploy quản lý release. Ghi exact node/npm version để dùng cả hai môi trường.
- [ ] **Step 4 — Firewall/SSH:** cho SSH từ IP quản trị trước, mở80/443, giữ session1 và mở session2 xác minh rồi mới enable UFW/harden SSH. Kiểm tra `ss -lntp`, `sudo ufw status verbose`; 3001 không có rule public. Không tắt root/password login trước khi key login và recovery được kiểm chứng.
- [ ] **Step 5 — Kiểm chứng:** session2 SSH được, host có Internet để npmci/fetch, đủ disk cho ít nhất3 releases và ảnh; ghi quyền bằng `namei -l /srv/rental-hub/shared/images`. Lỗi permission sửa owner/group, không chmod777.
- [ ] **Step 6 — Commit chỉ docs/template:** `git commit -m "docs: document VPS bootstrap and permissions"`.

### Task 2.2: Production build, Nginx và SPA routing

**Files:** `deploy/nginx/rental-hub.conf`, `docs/deploy/vps.md`, `docs/acceptance/task-2.md`.

**Interfaces:** Consumes task1+media builds, VPS dirs; produces release đầu tiên theo full commit SHA, current symlink, Nginx route separation cho2.3/4.2.

- [ ] **Step 1 — Viết checklist failing trước cấu hình:** ngoài mạng VPS `GET /`, `/rooms`, `/bookings` cần200 và HTML app; `/assets/not-found.js`, `/images/not-found.webp` cần404 không HTML app; file JS thực đúng MIME và WebP thực đúng image/webp; refresh browser render được.
- [ ] **Step 2 — Source/build:** clone exact commit vào release mới, ghi remote/SHA; `npm ci`, `npm run typecheck`, `npm test -- --run`, `npm run build`, `npm run build:media`. Tạo manifest `{releaseId, commit, builtAt, nodeVersion, npmVersion}` ở root release và copy cùng manifest vào dist/release.json cho lần deploy đầu, để API đọc được version trước khi có script task 4. Không dùng `npm run dev`/preview làm production server. Không sửa source trực tiếp trong release để khác Git SHA.
- [ ] **Step 3 — Nginx:** root current/dist; `location ^~ /assets/` alias shared/assets, `location ^~ /images/` alias shared/images, cả hai missing trả404; `/api/` riêng proxy; `location /` dùng `try_files $uri $uri/ /index.html`; index/release.json no-cache. Copy assets hash vào shared trước current activation; giữ older assets.
- [ ] **Step 4 — Kiểm chứng config và activate lần đầu:** `sudo nginx -t` phải successful rồi reload; curl loopback và public như checklist. Browser truy cập thẳng `/rooms`, refresh và CRUD. Ghi access/error log tương ứng request, không chỉ screenshot HTTP200.
- [ ] **Step 5 — Kiểm chứng lỗi đúng:** asset/image thiếu404, route hợp lệ200; route client lạ hiện trang404 app; với API chưa khởi động, 502 chỉ `/api/`, frontend vẫn chạy. Cách cấu hình alias không biến filename sai thành index.html.
- [ ] **Step 6 — Commit:** `git commit -m "feat: configure Nginx production routing"`.

### Task 2.3: Media systemd, auth, HTTPS và logs trên VPS

**Files:** `deploy/systemd/rental-hub-media.service`, nginx template, `deploy/env/media.env.example`, VPS runbook/acceptance.

**Interfaces:** Consumes server-dist, main env contract Media I.2; produces service/routing/auth/cert và evidence ảnh VPS. Unit `ExecStart` Node chạy `/srv/rental-hub/current/server-dist/server/main.js`; user media, EnvironmentFile `/etc/rental-hub/media.env`, NODE_ENV=production, Restart on-failure; exact Node binary đã ghi ở 2.1.

- [ ] **Step 1 — Test checklist:** unit active; `curl http://127.0.0.1:3001/api/health` releaseId đúng; external3001 không kết nối; upload chưa auth401; Origin sai403; upload đúng201; ảnh hai widths đọc được. Không gửi Basic credential bằng curlHTTP Internet.
- [ ] **Step 2 — Configure service:** env đúng roots/siteOrigin/releaseId; unit bootstrap enable/start; media chỉ ghi shared images/tmp. `systemctl status rental-hub-media`, `journalctl -u rental-hub-media -n 50` không có secret.
- [ ] **Step 3 — HTTPS nếu có domain:** kiểm tra A/AAAA và DNS propagation; configure server_name, ACME cert/renewal,80 redirect443; `curl -I https://<actual-host>/`, `openssl s_client -connect <actual-host>:443 -servername <actual-host>` chain/hostname/expiry đúng; renewal dry-run thành công. Điền host thật trong runbook trước chạy, không để placeholder vào config chạy.
- [ ] **Step 4 — Auth/rate/origin:** BasicAuth riêng exact location `/api/images`; password file ngoài repo; POST HTTP bị chặn; request body10MiB; Nginx rate1r/s burst3 status429; không bật CORS wildcard; browser cùng origin không giữ password trong Zustand/localStorage.
- [ ] **Step 5 — Kiểm chứng integration:** qua HTTPS browser upload ở building/room, kiểm tra hai URL WebP; unauth401/Origin403/input422/quá10MiB413; API vẫn loopback. Nếu chưa có HTTPS, kiểm tra auth/upload qua SSH tunnel local, ghi upload Internet là chưa đạt thay vì coi frontendHTTP thay thế được.
- [ ] **Step 6 — Evidence/commit:** checklist task2, URL/commit/version/log/HTTPS status và giới hạn; `git commit -m "feat: run secured media service on VPS"`.

### Task 3.1: Nghiệm thu kiến trúc AWS và network/quyền

**Files:** `docs/deploy/aws.md`, `docs/acceptance/task-3.md`; không sửa resource khi đang khảo sát.

**Interfaces:** Consumes AWS deployment đã có; produces kiến trúc được xác nhận, quyền/network và cách tích hợp media cho3.2. Baseline mới EC2/EBS; kiến trúc khác cần điều chỉnh trước mutation.

- [ ] **Step 1 — Inventory evidence:** ghi region, dịch vụ, URL, commit đã deploy, network, nơi lưu ảnh, domain/TLS, log đang bật. Không kết luận task3 đạt chỉ từ lời báo đã làm, cũng không kết luận cần làm lại.
- [ ] **Step 2 — Chốt nhánh:** EC2 → tái dùng2.1–2.3 trên host AWS với env riêng; S3/CloudFront → giữ frontend nếu đạt, viết design delta API compute + image storage + IAM + routing/auth/deploy/rollback và review trước khi thao tác. Không sao chép BasicAuth template Nginx vào CloudFront và coi đã bảo vệ được API.
- [ ] **Step 3 — Với EC2 baseline:** kiểm tra public subnet, route0.0.0.0/0→InternetGateway, publicIPv4, SG22/IP quản trị và80/443 public; private port3001 không mở; hostUFW khớp; root/runtime permissions; EBS persistence và delete-on-termination policy; không tạo IPv6 rule nếu chưa có network.
- [ ] **Step 4 — IAM/chi phí:** không dùng root access key hoặc nhúng AWS key vào build; nếu instance chỉ serve disk không cần rộng quyền S3; nếu dùng S3 thì policy giới hạn bucket/prefix/actions trong delta. Ghi instance/volume/publicIPv4/domain/CDN nào phát sinh chi phí và cách dừng/xóa resources do bài này tạo, không xóa resource cũ dùng chung.
- [ ] **Step 5 — Kiểm chứng:** ngoài AWS SSH/HTTP được đúng policy; AWS URL không trỏ/proxy qua VPS; ghi external checks và SG evidence, không lộ account secrets.
- [ ] **Step 6 — Commit:** `git commit -m "docs: verify AWS architecture and access controls"`.

### Task 3.2: Production, routing, ảnh và log trên AWS

**Files:** AWS runbook/acceptance; template chung nếu cần sửa có kiểm chứng VPS; delta config chỉ khi nhánhS3/CloudFront đã duyệt.

**Interfaces:** Consumes3.1 và2.2/2.3; produces AWS URL độc lập đủ chức năng/ảnh, release metadata và log. Script operations nhận host AWS riêng, không hardcode VPS.

- [ ] **Step 1 — Acceptance trước sửa:** public `/`, `/buildings`, `/rooms`, `/bookings` browser render và refresh; asset/image thiếu404 đúng; CRUD/booking chạy; HTTPS status và log; ảnh building/room upload201 trên AWS khi HTTPS có.
- [ ] **Step 2 — Với EC2:** clone/build exactSHA và triển khai giống2.2/2.3 vào disk/config riêng. Nếu đã deploy đúng, chỉ bổ sung media/routing/manifest còn thiếu; không reinstall runtime vô cớ.
- [ ] **Step 3 — Kiểm chứng độc lập:** browser originAWS tạo entity/ảnh mới, URL600/1200 hostAWS; xác minh config không có URLVPS; test AWS vẫn tải app/ảnh khi client block domainVPS trong Playwright. Không tắt VPSproduction chỉ để chứng minh độc lập.
- [ ] **Step 4 — Health/log/security:** runtime health/version khớpSHA; external3001 bị chặn; upload auth/origin đúng; Nginx/journal hoặc log dịch vụAWS truy được request; nếu có domain thì TLS/renew check nhưVPS. StaticS3/CloudFront tests theo delta không tự dùng EC2 commands.
- [ ] **Step 5 — Evidence:** cập nhật task3 checklist, architecture rationale2–3 câu, resource/permission/log/URLs/releaseSHA, phần đã đạt/phần thiếu. Mark complete khi đáp ứng nhánh được chọn và giới hạn HTTPS được công khai.
- [ ] **Step 6 — Commit:** `git commit -m "docs: verify independent AWS production deployment"`.
