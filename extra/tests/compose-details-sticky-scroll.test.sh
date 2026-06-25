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

grep -q 'class="compose-details-sticky" :style="detailsPaneStickyStyle"' "$compose_vue" \
    || fail "compose details pane must use an inner sticky wrapper"

grep -q 'windowTop: 0' "$compose_vue" \
    || fail "compose details pane must track capped page scroll like StackList"

grep -q 'height: `calc(100vh - 160px + ${this.windowTop}px)`' "$compose_vue" \
    || fail "compose details pane must grow its viewport height while page scrolls"

python3 - "$compose_vue" <<'PY' || fail "sticky behavior must live inside the details flex pane"
import sys

source = open(sys.argv[1], encoding="utf-8").read()

aside = source.find('id="compose-details-pane"')
sticky = source.find('class="compose-details-sticky"', aside)
aside_close = source.find('</aside>', aside)

if aside == -1 or sticky == -1 or aside_close == -1 or not aside < sticky < aside_close:
    sys.exit(1)

style_start = source.find("<style scoped lang=\"scss\">")
style_end = source.find("</style>", style_start)
style = source[style_start:style_end]

def block(selector):
    index = style.find(selector)
    if index == -1:
        return ""
    start = style.find("{", index)
    end = style.find("}", start)
    return style[start:end]

pane_block = block(".compose-details-pane")
sticky_block = block(".compose-details-sticky")

if "position: sticky;" in pane_block or "overflow-y: auto;" in pane_block:
    sys.exit(1)

for declaration in ("position: sticky;", "overflow-y: auto;", "top: 10px;"):
    if declaration not in sticky_block:
        sys.exit(1)
PY

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
