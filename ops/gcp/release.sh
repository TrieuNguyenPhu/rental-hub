#!/usr/bin/env bash
set -euo pipefail

root=/srv/rental-hub
action=${1:-}
id=${2:-}

switch_current() {
  ln -s "$1" "$root/.current.$$"
  mv -Tf "$root/.current.$$" "$root/current"
}

case "$action" in
  activate)
    [[ $id =~ ^[0-9]{17}$ ]] || exit 2
    archive="/tmp/rental-hub-$id.tar.gz"
    release="$root/releases/$id"
    [[ -f $archive && ! -e $release ]] || exit 2
    staging=$(mktemp -d "$root/releases/.staging.XXXXXX")
    trap 'rm -rf -- "$staging"' EXIT
    tar -xzf "$archive" -C "$staging"
    [[ -s $staging/index.html && -s $staging/release.json ]] || exit 2
    mv "$staging" "$release"
    trap - EXIT
    if [[ -L $root/current ]]; then
      old=$(readlink -f "$root/current")
      [[ $old == "$root/releases/"* && -s $old/index.html ]] || exit 2
      ln -sfn "$old" "$root/previous"
    elif [[ -e $root/current ]]; then
      echo 'Refusing to overwrite a non-symlink current site' >&2
      exit 2
    fi
    switch_current "$release"
    rm -f -- "$archive"
    ;;
  rollback)
    if [[ -L $root/previous ]]; then
      old=$(readlink -f "$root/previous")
      [[ $old == "$root/releases/"* && -s $old/index.html ]] || exit 2
      switch_current "$old"
    elif [[ -L $root/current ]]; then
      rm -- "$root/current"
    fi
    ;;
  *) echo 'Usage: release.sh activate RELEASE_ID | rollback' >&2; exit 2 ;;
esac
