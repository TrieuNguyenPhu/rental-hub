#!/usr/bin/env bash
# Shared by the three release commands so validation, locking and recovery agree.
set -euo pipefail
SCRIPTS=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
fail() { echo "ERROR: $*" >&2; exit 1; }
init_release() {
  umask 022
  [[ $# == 2 && $1 =~ ^[a-f0-9]{40}$ ]] || fail 'Usage: command <full commit SHA> <trusted config file>'
  SHA=$1
  local config mode owner directory
  config=$(realpath -e -- "$2")
  mode=$(stat -c %a -- "$config"); owner=$(stat -c %u -- "$config")
  (( (8#$mode & 0022) == 0 )) || fail 'Config must not be group/world writable'
  [[ $owner == 0 || $owner == "$(id -u)" ]] || fail 'Config must belong to root or the current user'
  # shellcheck disable=SC1090
  source "$config"
  : "${APP_ROOT:?Missing APP_ROOT}" "${REPO_URL:?Missing REPO_URL}" "${SITE_URL:?Missing SITE_URL}"
  [[ $APP_ROOT == /* && ! -L $APP_ROOT ]] || fail 'APP_ROOT must be an existing absolute directory, not a symlink'
  APP_ROOT=$(realpath -e -- "$APP_ROOT")
  case "$APP_ROOT" in /|/srv|/tmp|/var|/etc|/usr|/home|/root|"$HOME") fail 'Unsafe APP_ROOT';; esac
  for directory in releases shared shared/assets shared/images shared/tmp; do
    [[ -d $APP_ROOT/$directory && ! -L $APP_ROOT/$directory && $(realpath -e "$APP_ROOT/$directory") == "$APP_ROOT/$directory" ]] || fail "Unsafe or missing directory: $directory"
  done
  SITE_URL=${SITE_URL%/}
  node -e 'const u=new URL(process.argv[1]); if(!["http:","https:"].includes(u.protocol)||u.origin!==process.argv[1]) process.exit(1)' "$SITE_URL" || fail 'SITE_URL must be an HTTP(S) origin without credentials/path'
  MEDIA_ENV=${MEDIA_ENV:-/etc/rental-hub/media.env}
  RELEASE="$APP_ROOT/releases/$SHA"
  [[ ! -L $APP_ROOT/.deploy.lock ]] || fail 'Lock file cannot be a symlink'
  exec 9>"$APP_ROOT/.deploy.lock"
  flock -w 30 9 || fail 'Another deploy/rollback owns the lock'
  STAGING='' CANDIDATE_PID='' PREVIOUS='' ACTIVATING=false
  trap finish EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
}

check_release() {
  local directory=$1 expected=$2
  [[ -d $directory && ! -L $directory && $(realpath -e "$directory") == "$APP_ROOT/releases/$expected" ]] || fail 'Release path is invalid'
  [[ -f $directory/release.sha256 && -f $directory/dist/index.html && -f $directory/server-dist/server/main.js && -d $directory/node_modules ]] || fail 'Release is incomplete'
  (cd "$directory" && sha256sum --check --quiet release.sha256 && node --input-type=module -e '
    import fs from "node:fs";
    const m=JSON.parse(fs.readFileSync("release.json"));
    if(m.releaseId!==process.argv[1] || m.commit!==process.argv[1] || fs.readFileSync("release.json","utf8")!==fs.readFileSync("dist/release.json","utf8")) process.exit(1);
    await import("sharp");' "$expected")
}

build_release() {
  if [[ -e $RELEASE || -L $RELEASE ]]; then check_release "$RELEASE" "$SHA"; return; fi
  echo "BUILD $SHA"
  STAGING=$(mktemp -d "$APP_ROOT/releases/.build.XXXXXX")
  git clone --quiet --no-checkout -- "$REPO_URL" "$STAGING"
  git -C "$STAGING" checkout --quiet --detach "$SHA"
  [[ $(git -C "$STAGING" rev-parse HEAD) == "$SHA" ]] || fail 'Checkout does not match requested commit'
  (
    cd "$STAGING"
    [[ $(node -p 'process.versions.node.split(".")[0]') == 24 ]] || fail 'Use Node.js 24 for repeatable builds'
    npm ci --no-audit --no-fund
    npm run lint
    npm run typecheck
    npm test
    npm run build
    npm run build:media
    mkdir -p dist server-dist/server
    cp -a .local/build/web/. dist/
    cp -a .local/build/media/apps/media/src/. server-dist/server/
    npm ci --omit=dev --no-audit --no-fund
    node --input-type=module -e 'await import("sharp")'
    node --input-type=module - "$SHA" "$(npm --version)" <<'NODE'
import fs from 'node:fs';
const sha = process.argv[2];
const html = fs.readFileSync('dist/index.html', 'utf8');
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(m => m[1]);
if (!assets.some(a => a.endsWith('.js')) || assets.some(a => a.includes('..') || !fs.statSync('dist' + a).isFile())) throw Error('Missing build assets');
const manifest = JSON.stringify({releaseId:sha, commit:sha, builtAt:new Date().toISOString(), nodeVersion:process.version, npmVersion:process.argv[3]}) + '\n';
fs.writeFileSync('release.json', manifest);
fs.writeFileSync('dist/release.json', manifest);
NODE
    find dist server-dist node_modules release.json package.json package-lock.json -type f -print0 | sort -z | xargs -0 sha256sum > release.sha256
  )
  chmod 755 "$STAGING"
  mv -- "$STAGING" "$RELEASE"
  STAGING=
  check_release "$RELEASE" "$SHA"
}

publish_assets() {
  local file relative target
  while IFS= read -r -d '' file; do
    relative=${file#"$RELEASE/dist/assets/"}
    target="$APP_ROOT/shared/assets/$relative"
    [[ ! -L $target ]] || fail 'Asset cannot be a symlink'
    mkdir -p -- "$(dirname -- "$target")"
    [[ $(realpath -e "$(dirname -- "$target")") == "$APP_ROOT/shared/assets"* ]] || fail 'Asset escaped shared storage'
    if [[ -e $target ]]; then cmp -s -- "$file" "$target" || fail "Asset filename collision: $relative"
    else install -m 644 -- "$file" "$target"; fi
  done < <(find "$RELEASE/dist/assets" -type f -print0)
}

switch_link() {
  local name=$1 target=$2
  [[ ! -e $APP_ROOT/$name || -L $APP_ROOT/$name ]] || fail "$name must be a symlink"
  ln -s -- "$target" "$APP_ROOT/.$name.$$"
  mv -Tf -- "$APP_ROOT/.$name.$$" "$APP_ROOT/$name"
}

wait_health() {
  local port=$1
  for ((attempt=0; attempt<30; attempt++)); do
    if curl --silent --fail --max-time 1 "http://127.0.0.1:$port/api/health" > /dev/null; then return; fi
    sleep .2
  done
  return 1
}

stop_candidate() {
  if [[ -n $CANDIDATE_PID ]]; then kill "$CANDIDATE_PID" 2>/dev/null || true; wait "$CANDIDATE_PID" 2>/dev/null || true; CANDIDATE_PID=; fi
  [[ ! -L $APP_ROOT/candidate ]] || rm -- "$APP_ROOT/candidate"
}

check_candidate() {
  [[ -r $MEDIA_ENV ]] || fail 'Media environment file is required'
  switch_link candidate "$RELEASE"
  (
    cd "$RELEASE"
    exec env NODE_ENV=production MEDIA_PORT=3002 MEDIA_READ_ONLY=true SITE_ORIGIN="$SITE_URL" IMAGES_ROOT="$APP_ROOT/shared/images" TEMP_ROOT="$APP_ROOT/shared/tmp" node --env-file="$MEDIA_ENV" server-dist/server/main.js
  ) > "$APP_ROOT/candidate-media.log" 2>&1 9>&- &
  CANDIDATE_PID=$!
  wait_health 3002
  kill -0 "$CANDIDATE_PID" || fail 'Candidate exited; inspect candidate-media.log'
  bash "$SCRIPTS/smoke.sh" http://127.0.0.1:8081 "$SHA"
  stop_candidate
}

activate_release() {
  if [[ -L $APP_ROOT/current ]]; then
    local old_current
    old_current=$(readlink -m "$APP_ROOT/current")
    [[ $old_current == "$APP_ROOT/releases/${old_current##*/}" && ${old_current##*/} =~ ^[a-f0-9]{40}$ ]] || fail 'Current release points outside releases'
    if (check_release "$old_current" "${old_current##*/}"); then PREVIOUS=$old_current
    else echo 'Current release is damaged; only the verified target can be activated' >&2; fi
  elif [[ -e $APP_ROOT/current ]]; then fail 'Current must be a symlink'; fi
  ACTIVATING=true
  echo "ACTIVATE $SHA"
  switch_link current "$RELEASE"
  sudo -n systemctl restart rental-hub-media
  wait_health 3001
  bash "$SCRIPTS/smoke.sh" "$SITE_URL" "$SHA"
  if [[ -n $PREVIOUS && $PREVIOUS != "$RELEASE" ]]; then switch_link previous "$PREVIOUS"; fi
  ACTIVATING=false
  echo "VERIFIED $SHA $SITE_URL"
}

finish() {
  local status=$?
  trap - EXIT INT TERM
  set +e
  stop_candidate
  if [[ $ACTIVATING == true ]]; then
    status=1
    if [[ -n $PREVIOUS ]]; then
      echo "RECOVER ${PREVIOUS##*/}" >&2
      if switch_link current "$PREVIOUS" && sudo -n systemctl restart rental-hub-media && wait_health 3001 && bash "$SCRIPTS/smoke.sh" "$SITE_URL" "${PREVIOUS##*/}"; then
        echo 'Recovery verified; requested deployment still failed' >&2
      else echo 'RECOVERY FAILED: inspect current, systemd and Nginx immediately' >&2; fi
    else
      [[ ! -L $APP_ROOT/current ]] || rm -- "$APP_ROOT/current"
      sudo -n systemctl stop rental-hub-media
      echo 'Activation failed; no previous release is recoverable' >&2
    fi
  fi
  if [[ -n $STAGING && $STAGING == "$APP_ROOT/releases/.build."* && -d $STAGING && ! -L $STAGING ]]; then rm -rf -- "$STAGING"; fi
  rm -f -- "$APP_ROOT/.current.$$" "$APP_ROOT/.candidate.$$" "$APP_ROOT/.previous.$$"
  exit "$status"
}
