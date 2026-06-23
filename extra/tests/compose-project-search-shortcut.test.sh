#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
stack_list_vue="$repo_root/frontend/src/components/StackList.vue"
compose_vue="$repo_root/frontend/src/pages/Compose.vue"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

grep -q 'showProjectSearch' "$stack_list_vue" \
    || fail "Stack list must track whether the project search palette is open"

grep -q 'projectSearchQuery' "$stack_list_vue" \
    || fail "Stack list must track the project search query"

grep -q 'filteredProjectSearchItems' "$stack_list_vue" \
    || fail "Project search must expose filtered compose project results"

grep -q 'projectSearchItems' "$stack_list_vue" \
    || fail "Project search must build results from compose projects"

grep -q "this.\$root.completeStackList" "$stack_list_vue" \
    || fail "Project search must use the existing complete compose project list"

grep -q 'stackSearchPlaceholder' "$stack_list_vue" \
    || fail "Existing stack search field must expose an OS-specific shortcut placeholder"

grep -q ':placeholder="stackSearchPlaceholder"' "$stack_list_vue" \
    || fail "Existing stack search field must use the OS-specific shortcut placeholder"

grep -q 'CMD+K' "$stack_list_vue" \
    || fail "macOS placeholder must mention CMD+K"

grep -q 'STRG+K' "$stack_list_vue" \
    || fail "non-macOS German placeholder must mention STRG+K"

grep -Eq 'navigator\.(userAgentData\?\.platform|platform)' "$stack_list_vue" \
    || fail "Shortcut placeholder must detect the current OS"

grep -q 'handleProjectSearchKeydown' "$stack_list_vue" \
    || fail "Project search must handle keyboard navigation"

grep -q 'handleGlobalProjectSearchShortcut' "$stack_list_vue" \
    || fail "Stack list must register the global project search shortcut"

grep -q 'openProjectSearch' "$stack_list_vue" \
    || fail "Stack list must open the project search palette"

grep -q 'selectProjectSearchItem' "$stack_list_vue" \
    || fail "Project search must select a compose project"

grep -q "this.\$router.push" "$stack_list_vue" \
    || fail "Selecting a project must navigate to that compose project"

grep -Eq 'event\.(ctrlKey|metaKey).+event\.(metaKey|ctrlKey)|event\.(metaKey|ctrlKey).+event\.(ctrlKey|metaKey)' "$stack_list_vue" \
    || fail "Project search shortcut must accept both Ctrl+K and Cmd+K"

grep -q 'event.key.toLowerCase() === "k"' "$stack_list_vue" \
    || fail "Project search shortcut must use the K key"

grep -q 'event.key === "ArrowDown"' "$stack_list_vue" \
    || fail "Project search must support ArrowDown"

grep -q 'event.key === "ArrowUp"' "$stack_list_vue" \
    || fail "Project search must support ArrowUp"

grep -q 'event.key === "Enter"' "$stack_list_vue" \
    || fail "Project search must support Enter selection"

grep -q 'event.key === "Escape"' "$stack_list_vue" \
    || fail "Project search must support Escape close"

python3 - "$stack_list_vue" "$compose_vue" <<'PY'
from pathlib import Path
import sys

stack_list = Path(sys.argv[1]).read_text()
compose = Path(sys.argv[2]).read_text()

checks = {
    'class="project-search-dialog"': "project search dialog markup not found",
    'ref="projectSearchInput"': "project search input ref not found",
    'role="listbox"': "project search results must use listbox semantics",
    ':aria-activedescendant': "project search input must expose active descendant",
    '{{ item.name }}': "project search results must display compose project names",
    'selectProjectSearchItem(item)': "selecting a result must pass the whole project item",
    'encodeURIComponent(item.name)': "project navigation must URL-encode stack names",
    'encodeURIComponent(item.endpoint)': "project navigation must URL-encode endpoints",
}

for needle, message in checks.items():
    if needle not in stack_list:
        raise SystemExit(f"FAIL: {message}")

if 'Container suchen' in stack_list:
    raise SystemExit("FAIL: project search must not keep the old container placeholder")
if 'containerName' in stack_list:
    raise SystemExit("FAIL: project search must not expose container result names")

removed_from_compose = [
    'showContainerSearch',
    'containerSearchQuery',
    'filteredContainerSearchItems',
    'handleGlobalContainerSearchShortcut',
    'container-search-dialog',
]

for needle in removed_from_compose:
    if needle in compose:
        raise SystemExit(f"FAIL: Compose.vue must no longer own container search code: {needle}")
PY

echo "PASS compose-project-search-shortcut"
