#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_vue="$repo_root/frontend/src/pages/Compose.vue"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

grep -q 'showContainerSearch' "$compose_vue" \
    || fail "Compose view must track whether the container search palette is open"

grep -q 'containerSearchQuery' "$compose_vue" \
    || fail "Compose view must track the container search query"

grep -q 'filteredContainerSearchItems' "$compose_vue" \
    || fail "Container search must expose filtered service results"

grep -q 'handleContainerSearchKeydown' "$compose_vue" \
    || fail "Container search must handle keyboard navigation"

grep -q 'openContainerSearch' "$compose_vue" \
    || fail "Compose view must open the container search palette"

grep -q 'selectContainerSearchItem' "$compose_vue" \
    || fail "Container search must select a service"

grep -q 'scrollToContainer' "$compose_vue" \
    || fail "Selecting a search result must scroll to a container card"

grep -Eq 'event\.(ctrlKey|metaKey).+event\.(metaKey|ctrlKey)|event\.(metaKey|ctrlKey).+event\.(ctrlKey|metaKey)' "$compose_vue" \
    || fail "Container search shortcut must accept both Ctrl+K and Cmd+K"

grep -q 'event.key.toLowerCase() === "k"' "$compose_vue" \
    || fail "Container search shortcut must use the K key"

grep -q 'event.key === "ArrowDown"' "$compose_vue" \
    || fail "Container search must support ArrowDown"

grep -q 'event.key === "ArrowUp"' "$compose_vue" \
    || fail "Container search must support ArrowUp"

grep -q 'event.key === "Enter"' "$compose_vue" \
    || fail "Container search must support Enter selection"

grep -q 'event.key === "Escape"' "$compose_vue" \
    || fail "Container search must support Escape close"

grep -q 'scrollIntoView' "$compose_vue" \
    || fail "Container search selection must scroll the container into view"

python3 - "$compose_vue" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text()

search_panel = source.find('class="container-search-dialog"')
search_input = source.find('ref="containerSearchInput"')
listbox = source.find('role="listbox"')
active_descendant = source.find(':aria-activedescendant')
container_refs = source.find(':ref="')

if search_panel == -1:
    raise SystemExit("FAIL: container search dialog markup not found")
if search_input == -1:
    raise SystemExit("FAIL: container search input ref not found")
if listbox == -1:
    raise SystemExit("FAIL: container search results must use listbox semantics")
if active_descendant == -1:
    raise SystemExit("FAIL: container search input must expose active descendant")
if container_refs == -1:
    raise SystemExit("FAIL: container cards must be addressable by dynamic refs")
if "this.composeFocusMode = false" not in source:
    raise SystemExit("FAIL: selecting a container must leave focus mode so the details pane is visible")
if "this.highlightedContainerName = name" not in source:
    raise SystemExit("FAIL: selected container should be highlighted after scrolling")
PY

echo "PASS compose-container-search-shortcut"
