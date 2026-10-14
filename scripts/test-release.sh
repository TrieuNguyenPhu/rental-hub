#!/usr/bin/env bash
# Real Git/filesystem/HTTP; npm and service management use small disposable fixtures.
set -euo pipefail
scripts=$(cd -- "$(dirname -- "$0")" && pwd)
test_root=$(mktemp -d /tmp/rental-hub-release-test.XXXXXX)
cleanup() {
  if [[ -f $test_root/live.pid ]]; then kill "$(cat "$test_root/live.pid")" 2>/dev/null || true; fi
  [[ ! -f $test_root/nginx.pid ]] || kill "$(cat "$test_root/nginx.pid")" 2>/dev/null || true
  [[ $test_root == /tmp/rental-hub-release-test.* ]] && rm -rf -- "$test_root"
}
trap cleanup EXIT
export TEST_ROOT=$test_root
mkdir -p "$test_root/bin" "$test_root/repo" "$test_root/app"/{releases,shared/{assets,images,tmp}}
printf 'keep this photo\n' > "$test_root/app/shared/images/photo.webp"
before=$(sha256sum "$test_root/app/shared/images/photo.webp")
cat > "$test_root/config" <<EOF
APP_ROOT='$test_root/app'
REPO_URL='$test_root/repo'
SITE_URL='http://127.0.0.1:18080'
MEDIA_ENV='$test_root/media.env'
EOF
chmod 600 "$test_root/config"
cat > "$test_root/media.env" <<EOF
NODE_ENV=production
SITE_ORIGIN=http://127.0.0.1:18080
IMAGES_ROOT=$test_root/app/shared/images
TEMP_ROOT=$test_root/app/shared/tmp
EOF
cat > "$test_root/repo/package.json" <<'EOF'
{"type":"module"}
EOF
echo '{"lockfileVersion":3}' > "$test_root/repo/package-lock.json"
cat > "$test_root/repo/media.js" <<'EOF'
import http from 'node:http';
import fs from 'node:fs';
const release = JSON.parse(fs.readFileSync('release.json'));
if (fs.existsSync('bad-candidate') && process.env.MEDIA_READ_ONLY === 'true') process.exit(1);
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (fs.existsSync('bad-active') && process.env.MEDIA_READ_ONLY !== 'true') {
    res.writeHead(503); res.end('{}'); return;
  }
  if (req.url === '/api/health') res.end(JSON.stringify({status:'ok', releaseId:release.releaseId}));
  else { res.writeHead(503); res.end('{}'); }
}).listen(Number(process.env.MEDIA_PORT || 3001), '127.0.0.1');
process.on('SIGTERM', () => server.close());
EOF
cat > "$test_root/bin/npm" <<'EOF'
#!/usr/bin/env bash
set -eu
echo "$*" >> "$TEST_ROOT/npm.log"
if [[ $1 == --version ]]; then echo 11.0.0; exit; fi
if [[ $1 == ci ]]; then
  mkdir -p node_modules/sharp
  echo '{"type":"module","main":"index.js"}' > node_modules/sharp/package.json
  echo 'export default {}' > node_modules/sharp/index.js
elif [[ $1 == run ]]; then
  [[ ! -f fail-build ]] || exit 1
  if [[ $2 == build ]]; then
    sha=$(git rev-parse HEAD)
    mkdir -p dist/assets
    printf 'console.log("%s")' "$sha" > "dist/assets/$sha.js"
    printf '<!doctype html><div id="root"></div><script type="module" src="/assets/%s.js"></script>' "$sha" > dist/index.html
  elif [[ $2 == build:media ]]; then
    mkdir -p server-dist/server
    cp media.js server-dist/server/main.js
  fi
fi
EOF
cat > "$test_root/bin/sudo" <<'EOF'
#!/usr/bin/env bash
set -eu
[[ $* == '-n systemctl restart rental-hub-media' || $* == '-n systemctl stop rental-hub-media' ]] || exit 1
if [[ -f $TEST_ROOT/live.pid ]]; then
  pid=$(cat "$TEST_ROOT/live.pid")
  kill "$pid" 2>/dev/null || true
  for ((i=0; i<30; i++)); do kill -0 "$pid" 2>/dev/null || break; sleep .1; done
fi
if [[ $3 == restart ]]; then
  if [[ -f $TEST_ROOT/hold-restart ]]; then rm "$TEST_ROOT/hold-restart"; sleep 2; fi
  cd "$TEST_ROOT/app/current"
  MEDIA_PORT=3001 node --env-file="$TEST_ROOT/media.env" server-dist/server/main.js > "$TEST_ROOT/live.log" 2>&1 9>&- &
  echo $! > "$TEST_ROOT/live.pid"
fi
EOF
chmod +x "$test_root/bin/"*
export PATH="$test_root/bin:$PATH"
git -C "$test_root/repo" init -q
git -C "$test_root/repo" config user.email fixture@example.invalid
git -C "$test_root/repo" config user.name Fixture
git -C "$test_root/repo" add .
git -C "$test_root/repo" commit -qm A
a=$(git -C "$test_root/repo" rev-parse HEAD)
echo B > "$test_root/repo/version"
git -C "$test_root/repo" add .; git -C "$test_root/repo" commit -qm B
b=$(git -C "$test_root/repo" rev-parse HEAD)
touch "$test_root/repo/fail-build"
git -C "$test_root/repo" add .; git -C "$test_root/repo" commit -qm failure
bad=$(git -C "$test_root/repo" rev-parse HEAD)
expect_failure() { if "$@" > "$test_root/expected-failure.log" 2>&1; then echo "FAIL: unexpectedly succeeded: $*"; exit 1; fi; }
assert_current() { [[ $(readlink -f "$test_root/app/current") == "$test_root/app/releases/$1" ]] || { echo 'FAIL: current changed unexpectedly'; exit 1; }; }
bash "$scripts/build-release.sh" "$a" "$test_root/config"
ln -s "releases/$a" "$test_root/app/current"
expect_failure bash "$scripts/build-release.sh" "$bad" "$test_root/config"
assert_current "$a"
[[ ! -e $test_root/app/releases/$bad ]]
[[ $(node -p "JSON.parse(require('fs').readFileSync('$test_root/app/releases/$a/release.json')).releaseId") == "$a" ]]
echo 'PASS: build failure preserves current; complete manifest'
bash "$scripts/build-release.sh" "$b" "$test_root/config"
if [[ ${1:-} == --build-only ]]; then exit; fi

nginx_bin=${NGINX_BIN:-nginx}
mime_types=${NGINX_MIME_TYPES:-/etc/nginx/mime.types}
templates="$scripts/../deploy/nginx"
for template in rental-hub.conf rental-hub-locations.conf rental-hub-staging.conf; do
  sed -e "s|/srv/rental-hub|$test_root/app|g" \
    -e "s|/etc/nginx/snippets/|$test_root/|g" \
    -e "s|/var/log/nginx/|$test_root/|g" \
    -e 's/listen 80;/listen 127.0.0.1:18080;/' \
    "$templates/$template" > "$test_root/$template"
done
cat > "$test_root/nginx.conf" <<EOF
pid $test_root/nginx.pid;
error_log $test_root/error.log;
events {}
http {
  include $mime_types;
  access_log $test_root/access.log;
  proxy_temp_path $test_root/proxy;
  client_body_temp_path $test_root/body;
  fastcgi_temp_path $test_root/fastcgi;
  uwsgi_temp_path $test_root/uwsgi;
  scgi_temp_path $test_root/scgi;
  include $test_root/rental-hub.conf;
  include $test_root/rental-hub-staging.conf;
}
EOF
"$nginx_bin" -p "$test_root/" -c "$test_root/nginx.conf"
bash "$scripts/deploy.sh" "$a" "$test_root/config"
[[ $(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:18080/api/images) == 403 ]]
bash "$scripts/deploy.sh" "$b" "$test_root/config"
assert_current "$b"
curl -fsS "http://127.0.0.1:18080/assets/$a.js" > /dev/null
[[ $before == "$(sha256sum "$test_root/app/shared/images/photo.webp")" ]]
echo 'PASS: A to B keeps old assets and images'
mv "$test_root/app/releases/$a/node_modules" "$test_root/saved-runtime"
expect_failure bash "$scripts/rollback.sh" "$a" "$test_root/config"
assert_current "$b"
mv "$test_root/saved-runtime" "$test_root/app/releases/$a/node_modules"
build_log=$(sha256sum "$test_root/npm.log")
bash "$scripts/rollback.sh" "$a" "$test_root/config"
assert_current "$a"
[[ $build_log == "$(sha256sum "$test_root/npm.log")" ]]
echo 'PASS: incomplete rollback refused; complete rollback A without build'
git -C "$test_root/repo" rm -q fail-build
touch "$test_root/repo/bad-active"
git -C "$test_root/repo" add .; git -C "$test_root/repo" commit -qm bad-active
active_bad=$(git -C "$test_root/repo" rev-parse HEAD)
expect_failure bash "$scripts/deploy.sh" "$active_bad" "$test_root/config"
assert_current "$a"
bash "$scripts/smoke.sh" http://127.0.0.1:18080 "$a"
echo 'PASS: failed activation automatically recovers A'
git -C "$test_root/repo" rm -q bad-active
touch "$test_root/repo/bad-candidate"
git -C "$test_root/repo" add .; git -C "$test_root/repo" commit -qm bad-candidate
candidate_bad=$(git -C "$test_root/repo" rev-parse HEAD)
live_pid=$(cat "$test_root/live.pid")
expect_failure bash "$scripts/deploy.sh" "$candidate_bad" "$test_root/config"
assert_current "$a"
[[ $(cat "$test_root/live.pid") == "$live_pid" ]]
echo 'PASS: candidate startup failure preserves the running process'
printf collision > "$test_root/app/shared/assets/$b.js"
expect_failure bash "$scripts/deploy.sh" "$b" "$test_root/config"
assert_current "$a"
cp "$test_root/app/releases/$b/dist/assets/$b.js" "$test_root/app/shared/assets/$b.js"
echo 'PASS: asset filename collision refused before activation'
touch "$test_root/hold-restart"
bash "$scripts/deploy.sh" "$b" "$test_root/config" > "$test_root/signal.log" 2>&1 &
deploy_pid=$!
for ((i=0; i<100; i++)); do
  [[ $(readlink -f "$test_root/app/current") != "$test_root/app/releases/$b" ]] || break
  sleep .1
done
assert_current "$b"
kill -TERM "$deploy_pid"
if wait "$deploy_pid"; then echo 'FAIL: terminated deploy reported success'; exit 1; fi
assert_current "$a"
bash "$scripts/smoke.sh" http://127.0.0.1:18080 "$a"
echo 'PASS: signal after activation recovers the previous release'
printf 'corrupted' > "$test_root/app/releases/$b/dist/index.html"
expect_failure bash "$scripts/deploy.sh" "$b" "$test_root/config"
assert_current "$a"
echo 'PASS: corrupt candidate never activated'
(flock -x 9; touch "$test_root/locked"; sleep 33) 9>"$test_root/app/.deploy.lock" &
locker=$!
while [[ ! -f $test_root/locked ]]; do sleep .1; done
expect_failure bash "$scripts/rollback.sh" "$a" "$test_root/config"
assert_current "$a"
wait "$locker"
[[ $before == "$(sha256sum "$test_root/app/shared/images/photo.webp")" ]]
echo 'PASS: concurrent rollback times out without changes'
rm "$test_root/app/current"
expect_failure bash "$scripts/deploy.sh" "$active_bad" "$test_root/config"
[[ ! -e $test_root/app/current && ! -L $test_root/app/current ]]
grep -q 'no previous release' "$test_root/expected-failure.log"
echo 'PASS: failed first deployment leaves no false active release'
