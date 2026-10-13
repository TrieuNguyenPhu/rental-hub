# Phiên bản và xử lý sự cố — Task 4–5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cập nhật và rollback trên cả VPS/AWS, giữ bản đang chạy khi build lỗi, có quy trình kiểm thử và chẩn đoán đủ demo.

**Architecture:** Script Bash tạo release theo full commit SHA, kiểm tra candidate, đổi current bằng atomic rename, restart media và smoke; lỗi sau activation phục hồi release cũ. Ảnh và hashed assets nằm ở shared; mỗi môi trường có config riêng.

**Tech Stack:** Git, Bash, flock, npm ci, Nginx, systemd, curl, Playwright. CI/CD là mở rộng sau baseline. AWS S3/CloudFront dùng design delta đã duyệt từ Deployment 3.1, không dùng symlink recipe của EC2.

**Spec:** [Thiết kế §7–§9](../specs/2026-10-13-rental-hub-design.md).

## Global Constraints

- Tuân theo [Global Constraints tổng](2026-10-13-rental-hub.md#global-constraints).
- releaseId là full commit SHA; build ngoài current; giữ current, previous và tối thiểu 3 release hoàn chỉnh.
- Không dọn ảnh/shared assets trong deploy/rollback. Dependency runtime thuộc release; rollback không rebuild.
- Deploy/rollback dùng chung lock; candidate không upload hoặc dọn temp production.
- Health 200 chưa đủ: kiểm tra version, route, asset và browser render.
- Rollback code không khôi phục localStorage. Schema không tương thích cần kế hoạch dữ liệu riêng.
- Fault drill chỉ ở sandbox hoặc cửa sổ demo được phép; không khóa SSH hoặc xóa ảnh.

## Review Focus

- Build/candidate lỗi giữ nguyên current và process: 4.1–4.2.
- Activation lỗi, thiếu previous, thiếu target rollback: 4.2–4.3.
- Deploy/rollback đồng thời hoặc nhận signal: 4.2–4.3.
- Tab cũ cần asset cũ; file thiếu không được trả HTML 200: 4.2 và 5.1.
- Chẩn đoán network, 403/404/502, frontend và TLS bằng evidence: 5.2.

## Files và interfaces

| File mục tiêu | Trách nhiệm |
|---|---|
| `scripts/build-release.sh` | Checkout exact SHA, kiểm tra/build, tạo candidate hoàn chỉnh |
| `scripts/deploy.sh` | Lock, kiểm tra candidate, activate, smoke và recover |
| `scripts/rollback.sh` | Kiểm tra release cũ, lock, activate, smoke và recover |
| `scripts/smoke.sh` | Kiểm tra HTTP, version, routes và static assets |
| `scripts/test-release.sh` | Assert-based shell test trong temp sandbox; stub git/npm/systemctl/curl khi cần |
| `deploy/nginx/rental-hub-staging.conf` | Candidate listen loopback 8081, media proxy 3002 |
| `deploy/env/deploy.env.example` | APP_ROOT, REPO_URL, SITE_URL; không secret |
| `docs/deploy/releases.md` | Lệnh và quy trình update/rollback |
| `docs/runbook/troubleshooting.md` | Chẩn đoán, fix và xác minh |
| `docs/acceptance/task-4.md`, `task-5.md`, `demo.md` | Evidence theo đề mentor |

Commands, chạy trên target Linux:

```text
bash scripts/build-release.sh <fullCommitSha> <trustedConfigFile>
bash scripts/deploy.sh <fullCommitSha> <trustedConfigFile>
bash scripts/rollback.sh <existingReleaseSha> <trustedConfigFile>
bash scripts/smoke.sh <baseUrl> <expectedReleaseSha>
bash scripts/test-release.sh
```

Config thật có `APP_ROOT=/srv/rental-hub`, remote và origin đã xác nhận; không chạy placeholder. Config do operator quản lý, không lấy từ HTTP/client. SHA chấp nhận 40 hex theo repository SHA-1 của baseline; repository SHA-256 cần điều chỉnh validator trước dùng.

Resolve APP_ROOT trước mutation, từ chối root/home hoặc path ngoài thư mục ứng dụng được operator xác nhận. Cleanup chỉ trong releases/temp do script tạo và đã kiểm tra đường dẫn; quote biến, dùng `--` trước path. Shell test không chạy root, systemctl thật hoặc gọi production.

Candidate hoàn chỉnh có `dist`, `server-dist`, production `node_modules`, `release.json`; copy cùng manifest vào `dist/release.json`. Manifest `{releaseId, commit, builtAt, nodeVersion, npmVersion}` không chứa env/secret. Media đọc releaseId từ manifest của release chứa entrypoint, tránh env cố định trả SHA cũ. `startMediaServer` nhận releaseId trực tiếp khi test.

Scripts exit 0 khi đạt, khác 0 khi lỗi; log phase/releaseId. Smoke chỉ GET/HEAD, không tạo ảnh/bản ghi. Credential kiểm thử upload nằm ngoài repo, không log hoặc đưa vào URL.

### Task 4.1: Git và build release độc lập

**Files:** `.gitignore`, lockfile nếu thiếu; build-release/test-release; deploy env template và release runbook.

**Interfaces:** Consumes Git remote, APP_ROOT/REPO_URL, build/test commands App/Media; produces complete release/manifest, không đổi current.

- [ ] **Step 1 — Git preflight:** kiểm tra remote và working tree; source đã push; secrets/uploads/dist/node_modules ignored; SHA có trên remote. Dùng repo đã có của task 1/3, không commit thay đổi ngoài scope.
- [ ] **Step 2 — Test `release.buildFailureKeepsCurrent`:** fixture current → A, stub build B thất bại; assert exit khác 0, current vẫn A, không restart service, không có B hoàn chỉnh, checksum A không đổi. `release.completeManifest`: build B thành công có đủ output/runtime/manifest đúng SHA.
- [ ] **Step 3 — Chạy:** `bash scripts/test-release.sh`; xác nhận behavior thiếu gây FAIL. Fixture nằm trong temp directory do test tạo và kiểm tra trước cleanup.
- [ ] **Step 4 — Implement build:** validate config/SHA; checkout exact SHA trong staging mới; chạy npm ci, typecheck, unit tests, frontend build và media build; kiểm tra asset references. Cài runtime bằng `npm ci --omit=dev` trong candidate, kiểm tra Sharp import; ghi manifests, rename candidate sang release cuối cùng. Failure chỉ dọn staging của lần chạy này.
- [ ] **Step 5 — Kiểm chứng:** `bash -n scripts/build-release.sh scripts/test-release.sh`, shell assertions PASS; build B thật trên target, manifest đúng và Node chạy entrypoint được. A vẫn phục vụ vì chưa activate B.
- [ ] **Step 6 — Commit:** `git commit -m "feat: build immutable releases by commit"`.

### Task 4.2: Candidate, activation và tự phục hồi

**Files:** deploy/smoke/test-release, staging Nginx config, release runbook; production Nginx template nếu thiếu shared assets.

**Interfaces:** Consumes build-release, manifest, media config; produces deploy command + active current + version/health đúng. Shared lock `APP_ROOT/.deploy.lock`, timeout 30 giây; candidate Nginx 8081 và media 3002 chỉ loopback.

- [ ] **Step 1 — Test `deploy.failedCandidateNeverActivates`:** candidate smoke/runtime import lỗi → current A và process A nguyên, candidate process dừng. `deploy.activeFailureRestoresPrevious`: activate B rồi smoke lỗi → phục hồi A và kiểm tra A, deploy vẫn exit khác 0; nếu recovery cũng lỗi, báo recovery failed rõ ràng.
- [ ] **Step 2 — Test `deploy.lockAndSignals`:** second deploy/rollback timeout không mutation; signal trước activation chỉ dọn staging; signal sau activation phục hồi previous nếu có. Lần đầu lỗi không có previous phải báo không thể rollback, không tạo target giả.
- [ ] **Step 3 — Test `deploy.keepsOldAssets`:** A có a.js, B có b.js; sau B, cả hai asset vẫn đúng bytes/MIME. Cùng hashed filename nhưng nội dung khác phải fail trước switch. Checksum ảnh không đổi.
- [ ] **Step 4 — Chạy:** `bash scripts/test-release.sh`; assertions mới FAIL nếu thiếu behavior, không side effect production.
- [ ] **Step 5 — Prepare/candidate:** acquire lock; build B; publish assets mới, so sánh collision; chạy candidate media `readOnly: true` và staging Nginx; nginx -t trước reload; smoke candidate HTML/asset/health/version. Candidate không upload hoặc dọn temp production; luôn cleanup staging.
- [ ] **Step 6 — Activation/recovery:** lưu target A; tạo symlink tạm và atomic rename thành current trên cùng filesystem; restart media, smoke B. Lỗi phục hồi A + restart + smoke A. Trap xử lý exit/signal theo phase; sudo chỉ cho commands cần. Redeploy SHA hoàn chỉnh kiểm tra rồi dùng lại, không ghi đè.
- [ ] **Step 7 — Implement smoke:** manifest no-cache đúng SHA; `/rooms` trả HTML 200; lấy một asset thật từ index rồi kiểm tra 200/MIME khác HTML; missing JS/image trả 404; health status ok/version đúng. GET ảnh thật nếu đã có URL mẫu trong acceptance. Không follow redirect sang origin khác rồi kết luận origin ban đầu khỏe.
- [ ] **Step 8 — Kiểm chứng:** syntax/assertions PASS; sandbox A → B, candidate fail và active fail có evidence. Giữ browser tab A khi deploy B, old dynamic asset không 404. Runbook ghi upload có thể gián đoạn ngắn khi restart media.
- [ ] **Step 9 — Commit:** `git commit -m "feat: activate checked releases with automatic recovery"`.

### Task 4.3: Rollback và chứng minh cả hai môi trường

**Files:** rollback/test-release, releases runbook, task-4 acceptance.

**Interfaces:** Consumes complete releases + common lock/smoke; produces rollback existing SHA không rebuild. Target thiếu manifest/runtime/assets phải fail trước đổi current.

- [ ] **Step 1 — Test `rollback.rejectsIncompleteTarget`:** current B, target A thiếu runtime/asset hoặc manifest sai → exit khác 0, B giữ nguyên. `rollback.noRebuildNoDataLoss`: A đủ → A active, không chạy npm/git build, ảnh checksum không đổi; A health lỗi phải phục hồi B và báo lỗi.
- [ ] **Step 2 — Chạy:** `bash scripts/test-release.sh`; xác nhận test mới chỉ PASS khi có behavior cần.
- [ ] **Step 3 — Implement:** validate config/target/paths, acquire cùng lock; kiểm tra A, atomic switch, restart, smoke; target lỗi thì recover release vừa rời. Giữ current/previous/tối thiểu 3 complete releases; không tự dọn ảnh/assets.
- [ ] **Step 4 — VPS drill:** A chạy → B có thay đổi nhỏ nhìn thấy → rollback A. Ghi SHA/log/thời gian/checksum ảnh. Chứng minh build fail giữ A, candidate fail giữ A, active fail phục hồi A; fault commits không merge vào sản phẩm.
- [ ] **Step 5 — AWS drill:** lặp A → B → A và failure cases bằng config AWS, không tác động VPS. Với AWS static, dùng delta đã duyệt cho cache/version/invalidation và ảnh ngoài application prefix; không dùng symlink test làm evidence S3 rollback.
- [ ] **Step 6 — Nghiệm thu/commit:** cùng command contract dùng được cả hai, source remote, build lặp lại, manual rollback và active recovery đạt; ghi giới hạn storage schema. `git commit -m "feat: rollback verified releases on both environments"`.

### Task 5.1: Browser và truy cập production

**Files:** `e2e/production.spec.ts`, task-5 acceptance; Playwright config nhận SITE_URL ở runtime, không chứa secret.

**Interfaces:** Consumes App/Media/Deployment/Operations 4; produces evidence thực trên hai origin. Dùng dữ liệu giả và browser profile riêng.

- [ ] **Step 1 — Test `production.crudAndDeepLinks`:** vào thẳng ba routes, refresh, CRUD/overlap/cancel đúng; không Console error hoặc missing critical asset; unknown route có 404 UI.
- [ ] **Step 2 — Test `production.imagesAndStaticErrors`:** HTTPS upload building/room có auth, hai WebP đúng width và còn sau reload; missing image/JS là 404; upload chưa auth 401, Origin sai 403. Credential ngoài repo và output được che.
- [ ] **Step 3 — Test `production.versionAndCache`:** manifest/health đúng SHA; index no-cache; asset/ảnh cache đúng; tab A vẫn đọc asset A khi deploy B trong test window. Thiếu HTTPS thì frontend HTTP kiểm tra riêng, upload Internet chưa nghiệm thu.
- [ ] **Step 4 — Chạy:** trên Linux đặt `SITE_URL` rồi `npm run test:e2e -- e2e/production.spec.ts`; trên PowerShell đặt `$env:SITE_URL` rồi chạy cùng lệnh. Dùng origin thật, lặp VPS/AWS; manual keyboard và mobile viewport nếu chưa được test tự động.
- [ ] **Step 5 — Evidence/commit:** URL/SHA/test output/screenshot/log đã che secret. HTTP 200 nhưng React trắng là FAIL. `git commit -m "test: verify both production environments"`.

### Task 5.2: Runbook và diễn tập sự cố

**Files:** troubleshooting runbook, task-5 acceptance; sandbox config fixtures khi cần.

**Interfaces:** Consumes running release + recovery recipe; produces cách chẩn đoán nguyên nhân và phục hồi bằng evidence. Đây là integration drill, không unit test string log.

- [ ] **Step 1 — Chuẩn bị:** backup config, known-good SHA, SSH/recovery console và checksum ảnh; dùng sandbox hoặc cửa sổ demo đã được phép. Mỗi drill đổi một nguyên nhân, chuẩn bị cách khôi phục trước.
- [ ] **Step 2 — Website timeout:** đổi web port hoặc chặn 80/443 trong sandbox, giữ 22. Chẩn đoán DNS → IP/route → UFW/SG → `ss -lntp` → Nginx; restore, external curl/browser PASS.
- [ ] **Step 3 — 403:** sandbox thiếu read/traverse permission; curl, `namei -l`, Nginx error log cho evidence; sửa owner/group/mode hẹp, không chmod 777; kiểm tra lại và phân biệt auth 401.
- [ ] **Step 4 — 404/refresh:** sai root hoặc thiếu SPA fallback; `/rooms` refresh 404; kiểm tra `nginx -T`, file/root/alias và log; khôi phục fallback chỉ cho app, ảnh/JS thiếu vẫn 404.
- [ ] **Step 5 — 502:** stop media sandbox; `/api/health` 502 trong khi frontend 200; xem systemctl/journal/port/upstream; sửa unit/env/port, health/upload PASS. Không thêm proxy frontend chỉ để tạo lỗi 502.
- [ ] **Step 6 — Build pass nhưng frontend lỗi:** sandbox thiếu bundle hoặc sai Vite base; dùng Console/Network/MIME/SHA/cache làm evidence; sửa build config và deploy SHA mới hoặc rollback; kiểm tra React render thật.
- [ ] **Step 7 — Domain/HTTPS:** A/AAAA, server_name, 443, chain, expiry, clock, renew. Chưa có domain thì dùng sandbox DNS/cert fixture, ghi đây là mô phỏng; không claim domain production đã PASS.
- [ ] **Step 8 — Storage và rollback:** limited sandbox disk gây ENOSPC; upload 507, không partial images; phục hồi dung lượng không xóa ảnh người dùng; bad release → known-good theo 4.3, checksum ảnh giữ nguyên.
- [ ] **Step 9 — Evidence/commit:** mỗi drill có triệu chứng, timestamp/SHA, lệnh/output đã che, root cause, fix, post-check và recovery time; AWS nhắc SG/IAM/service đúng kiến trúc. `git commit -m "docs: add incident diagnosis and recovery drills"`.

### Task 5.3: Demo và nghiệm thu đề mentor

**Files:** demo acceptance, task 1–5/images acceptance và runbooks còn thiếu.

**Interfaces:** Consumes evidence tất cả task; produces bộ nộp mentor đối chiếu từng bullet; không thêm tính năng.

- [ ] **Step 1 — Demo 15–20 phút:** kiến trúc/giới hạn 2 phút; CRUD/booking 3 phút; hai width ảnh 2 phút; VPS/AWS/public refresh/log 3 phút; A → B → A/build fail 4 phút; sự cố và root cause 3 phút. Đây là thời lượng demo dự kiến, không ước lượng triển khai.
- [ ] **Step 2 — Coverage:** task 1 CRUD/types/Zustand/storage; task 2 SSH/source/build/server/firewall/public/routing/log/HTTPS có điều kiện; task 3 services/permissions/network/build/public/routing/log/HTTPS có điều kiện; task 4 Git/update/repeatable deploy/rollback/fail-build protection ở cả hai; task 5 mọi tình huống; ảnh building/room resize/WebP/600/1200/URLs.
- [ ] **Step 3 — Kiểm tra giới hạn:** không secret/dữ liệu khách thật trong repo/evidence; localStorage không đồng bộ; ảnh public và bỏ liên kết chưa tự xóa; upload HTTP bị chặn; API restart có gián đoạn ngắn; chi phí và resource cleanup được ghi.
- [ ] **Step 4 — Gate cuối:** typecheck/unit/build/media build, shell self-check, nginx -t, smoke và browser cả hai môi trường. Chỉ lặp fault drill khi có thay đổi hoặc kết quả chưa được kiểm chứng; không phá lại site chỉ để lặp evidence.
- [ ] **Step 5 — Completion/commit:** URL/SHA/evidence/commands, ghi rõ item chưa đạt; không đánh dấu hoàn thành vì đã có kế hoạch. `git commit -m "docs: prepare mentor acceptance and demo evidence"`.
