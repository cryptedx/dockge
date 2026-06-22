#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_vue="$repo_root/frontend/src/pages/Compose.vue"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

grep -q 'compose-workspace' "$compose_vue" \
    || fail "Compose view must wrap editor/details and bottom terminal in a workspace"

grep -q 'compose-terminal-panel' "$compose_vue" \
    || fail "Combined terminal must render in a dedicated bottom panel"

grep -q 'combinedTerminalCollapsed' "$compose_vue" \
    || fail "Bottom terminal panel must be collapsible"

grep -q 'toggleCombinedTerminalPanel' "$compose_vue" \
    || fail "Bottom terminal panel must refit the xterm instance after expanding"

python3 - "$compose_vue" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text()
terminal_ref = source.find('ref="combinedTerminal"')
details_pane = source.find('id="compose-details-pane"')
terminal_panel = source.find('compose-terminal-panel')
details_pane_close = source.find('</aside>', details_pane)

if terminal_ref == -1:
    raise SystemExit("FAIL: combined terminal ref not found")
if details_pane == -1:
    raise SystemExit("FAIL: details pane not found")
if terminal_panel == -1:
    raise SystemExit("FAIL: bottom terminal panel not found")
if details_pane_close == -1:
    raise SystemExit("FAIL: details pane closing tag not found")
if not terminal_panel < terminal_ref:
    raise SystemExit("FAIL: combined terminal must be rendered inside the bottom terminal panel")
if terminal_ref < details_pane_close:
    raise SystemExit("FAIL: combined terminal must not stay inside compose-details-pane")
PY

echo "PASS compose-bottom-terminal-panel"
