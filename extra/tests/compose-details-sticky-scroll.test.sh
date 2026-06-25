#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
dashboard_vue="$repo_root/frontend/src/pages/Dashboard.vue"
compose_vue="$repo_root/frontend/src/pages/Compose.vue"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

grep -q '<h2 class="stack-pane-title mb-3">Stacks</h2>' "$dashboard_vue" \
    || fail "desktop stack pane must have a matching Stacks heading"

grep -q ':style="detailsPaneStyle"' "$compose_vue" \
    || fail "compose details pane must use computed style for width and sticky height"

grep -q 'windowTop: 0' "$compose_vue" \
    || fail "compose details pane must track capped page scroll like StackList"

grep -q 'height: `calc(100vh - 160px + ${this.windowTop}px)`' "$compose_vue" \
    || fail "compose details pane must grow its viewport height while page scrolls"

grep -q 'window.addEventListener("scroll", this.onScroll)' "$compose_vue" \
    || fail "compose details pane must listen for page scroll"

python3 - "$compose_vue" <<'PY' || fail "compose details pane must sample scroll position when mounted"
import sys

source = open(sys.argv[1], encoding="utf-8").read()
mounted = source.split("    mounted() {", 1)[1].split("\n    updated() {", 1)[0]

if 'this.onScroll();' not in mounted:
    sys.exit(1)
PY

grep -q 'window.removeEventListener("scroll", this.onScroll)' "$compose_vue" \
    || fail "compose details pane must remove the page scroll listener"

grep -q 'if (window.top.scrollY <= 133)' "$compose_vue" \
    || fail "compose details pane must cap scroll growth the same way as StackList"

grep -q 'position: sticky;' "$compose_vue" \
    || fail "compose details pane must stay sticky while vertically scrolling"

grep -q 'overflow-y: auto;' "$compose_vue" \
    || fail "compose details pane must scroll internally when content is taller than the viewport"

grep -q 'height: auto !important;' "$compose_vue" \
    || fail "stacked/mobile details pane must not keep the desktop sticky height"

echo "PASS compose-details-sticky-scroll"
