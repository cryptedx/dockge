#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
terminal_vue="$repo_root/frontend/src/components/Terminal.vue"

python3 - "$terminal_vue" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text()
style_start = source.find('<style lang="scss">')
style_end = source.find('</style>', style_start)
if style_start == -1 or style_end == -1:
    raise SystemExit("FAIL: Terminal.vue must keep global xterm layout CSS")

style = source[style_start:style_end]

checks = {
    ".terminal": ["height: 100%", "overflow: hidden"],
    ".terminal .main-terminal": ["height: 100%", "width: 100%"],
    ".terminal .xterm": ["height: 100%", "width: 100%"],
    ".terminal .xterm-viewport": ["height: 100%"],
    ".terminal .xterm-screen": ["height: 100%"],
}

for selector, declarations in checks.items():
    selector_index = style.find(selector)
    if selector_index == -1:
        raise SystemExit(f"FAIL: missing {selector} layout rule")
    block_start = style.find("{", selector_index)
    block_end = style.find("}", block_start)
    if block_start == -1 or block_end == -1:
        raise SystemExit(f"FAIL: malformed {selector} layout rule")
    block = style[block_start:block_end]
    for declaration in declarations:
        if declaration not in block:
            raise SystemExit(f"FAIL: {selector} must set {declaration}")

resize_observer_index = source.find("new ResizeObserver")
if resize_observer_index == -1:
    raise SystemExit("FAIL: Terminal.vue must observe its rendered size")

if source.find("this.updateTerminalSize()", resize_observer_index) == -1:
    raise SystemExit("FAIL: terminal resize observer must refit xterm")

required_snippets = [
    "observeTerminalSize()",
    "this.terminalResizeObserver.observe(this.$el)",
    "this.terminalResizeObserver?.disconnect()",
    "const { width, height } = this.$el.getBoundingClientRect();",
    "if (width === 0 || height === 0) {",
    "onResizeEvent() {\n            this.updateTerminalSize();",
]

for snippet in required_snippets:
    if snippet not in source:
        raise SystemExit(f"FAIL: missing terminal visibility sizing guard: {snippet}")
PY

echo "PASS terminal-layout"
