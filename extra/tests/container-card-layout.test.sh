#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
container_vue="$repo_root/frontend/src/components/Container.vue"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

grep -q 'container-card-main' "$container_vue" \
    || fail "Container card must use a dedicated main layout wrapper"

grep -q 'container-summary' "$container_vue" \
    || fail "Container card must keep title, image and badges in a summary area"

grep -q 'container-action-grid' "$container_vue" \
    || fail "Container actions must use a wrapping grid, not a fixed Bootstrap row"

if grep -q 'class="row"' "$container_vue" || grep -q 'class="col-5"' "$container_vue" || grep -q 'class="col-7"' "$container_vue"; then
    fail "Container card header must not use fixed Bootstrap columns"
fi

grep -q 'overflow-wrap: anywhere;' "$container_vue" \
    || fail "Long container names and image references must be allowed to wrap"

echo "PASS container-card-layout"
