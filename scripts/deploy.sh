#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/release-common.sh
source "$(dirname -- "$0")/release-common.sh"
init_release "$@"
build_release
publish_assets
check_candidate
activate_release
