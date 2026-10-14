#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=ops/release/release-common.sh
source "$(dirname -- "$0")/release-common.sh"
init_release "$@"
check_release "$RELEASE" "$SHA"
publish_assets
check_candidate
activate_release
