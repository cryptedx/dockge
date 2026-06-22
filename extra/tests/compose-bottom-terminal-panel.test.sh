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

grep -q 'ref="composeYamlEditor"' "$compose_vue" \
    || fail "Bottom terminal panel must anchor to the YAML editor area"

grep -q 'this.$refs.composeYamlEditor' "$compose_vue" \
    || fail "Bottom terminal panel bounds must be measured from the YAML editor area"

grep -q 'combinedTerminalCollapsed' "$compose_vue" \
    || fail "Bottom terminal panel must be collapsible"

grep -q 'COMBINED_TERMINAL_COLLAPSED_STORAGE_KEY' "$compose_vue" \
    || fail "Bottom terminal panel collapsed state must use a named storage key"

grep -q 'window.localStorage.getItem(COMBINED_TERMINAL_COLLAPSED_STORAGE_KEY)' "$compose_vue" \
    || fail "Bottom terminal panel must restore collapsed state from localStorage"

grep -q 'window.localStorage.setItem(COMBINED_TERMINAL_COLLAPSED_STORAGE_KEY' "$compose_vue" \
    || fail "Bottom terminal panel must persist collapsed state to localStorage"

grep -q 'toggleCombinedTerminalPanel' "$compose_vue" \
    || fail "Bottom terminal panel must refit the xterm instance after expanding"

grep -Eq 'showCombinedTerminalPanel\(\)|showCombinedTerminalPanel:' "$compose_vue" \
    || fail "Bottom terminal panel visibility must be derived from edit and focus modes"

grep -q 'handleGlobalTerminalShortcut' "$compose_vue" \
    || fail "Bottom terminal panel must support the global Ctrl/Cmd+J shortcut"

grep -q 'window.addEventListener("keydown", this.handleGlobalTerminalShortcut)' "$compose_vue" \
    || fail "Bottom terminal panel shortcut must be registered globally"

grep -q 'window.removeEventListener("keydown", this.handleGlobalTerminalShortcut)' "$compose_vue" \
    || fail "Bottom terminal panel shortcut must be removed on unmount"

if grep -q 'window.addEventListener("scroll", this.updateCombinedTerminalPanelBounds' "$compose_vue"; then
    fail "Bottom terminal panel must not recalculate its fixed width on scroll"
fi

if grep -q 'window.removeEventListener("scroll", this.updateCombinedTerminalPanelBounds' "$compose_vue"; then
    fail "Bottom terminal panel must not register scroll-bound width cleanup"
fi

grep -Eq 'event\.(ctrlKey|metaKey).+event\.(metaKey|ctrlKey)|event\.(metaKey|ctrlKey).+event\.(ctrlKey|metaKey)' "$compose_vue" \
    || fail "Bottom terminal panel shortcut must accept both Ctrl+J and Cmd+J"

grep -q 'event.key.toLowerCase() === "j"' "$compose_vue" \
    || fail "Bottom terminal panel shortcut must use the J key"

grep -Eq 'position:[[:space:]]*(sticky|fixed)' "$compose_vue" \
    || fail "Bottom terminal panel must stay attached to the bottom edge while scrolling"

grep -q 'bottom: 0' "$compose_vue" \
    || fail "Bottom terminal panel must be anchored to the bottom edge"

python3 - "$compose_vue" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text()
terminal_ref = source.find('ref="combinedTerminal"')
details_pane = source.find('id="compose-details-pane"')
terminal_panel = source.find('compose-terminal-panel')
terminal_panel_visibility = source.find('v-show="showCombinedTerminalPanel"')
details_pane_close = source.find('</aside>', details_pane)

if terminal_ref == -1:
    raise SystemExit("FAIL: combined terminal ref not found")
if details_pane == -1:
    raise SystemExit("FAIL: details pane not found")
if terminal_panel == -1:
    raise SystemExit("FAIL: bottom terminal panel not found")
if terminal_panel_visibility == -1:
    raise SystemExit("FAIL: bottom terminal panel must use showCombinedTerminalPanel")
if details_pane_close == -1:
    raise SystemExit("FAIL: details pane closing tag not found")
if not terminal_panel < terminal_ref:
    raise SystemExit("FAIL: combined terminal must be rendered inside the bottom terminal panel")
if terminal_ref < details_pane_close:
    raise SystemExit("FAIL: combined terminal must not stay inside compose-details-pane")
if "!this.isEditMode && !this.composeFocusMode" not in source:
    raise SystemExit("FAIL: bottom terminal panel must hide in edit mode and focus mode")
PY

echo "PASS compose-bottom-terminal-panel"
