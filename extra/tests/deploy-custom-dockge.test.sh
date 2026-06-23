#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
SCRIPT="${REPO_ROOT}/extra/deploy-custom-dockge.sh"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

assert_contains() {
    local haystack="$1"
    local needle="$2"

    if [[ "${haystack}" != *"${needle}"* ]]; then
        fail "expected output to contain: ${needle}"
    fi
}

help_output="$(bash "${SCRIPT}" --help)"
assert_contains "${help_output}" "Usage:"
assert_contains "${help_output}" "--source-dir"
assert_contains "${help_output}" "--force-reset"

dry_run_output="$(
    SOURCE_DIR=/tmp/dockge-custom \
    COMPOSE_DIR=/tmp/dockge \
    BRANCH=codex/compose-split-pane \
    IMAGE=dockge:compose-split-pane \
    bash "${SCRIPT}" --dry-run --skip-backup
)"

assert_contains "${dry_run_output}" "[dry-run] git -C /tmp/dockge-custom fetch --prune origin codex/compose-split-pane"
assert_contains "${dry_run_output}" "[dry-run] docker build -t dockge:compose-split-pane -f /tmp/dockge-custom/docker/Dockerfile --target release /tmp/dockge-custom"
assert_contains "${dry_run_output}" "[dry-run] docker compose -f /tmp/dockge/compose.yaml -f /tmp/dockge/compose.custom-image.yaml down"
assert_contains "${dry_run_output}" "[dry-run] docker compose -f /tmp/dockge/compose.yaml -f /tmp/dockge/compose.custom-image.yaml up -d --force-recreate"

echo "PASS deploy-custom-dockge"
