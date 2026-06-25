# Compose Details Sticky Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the right compose container/details pane keep the same sticky vertical scroll behavior as the left stack list, and add a matching heading to the left stack column.

**Architecture:** Reuse the existing stack-list behavior instead of adding a new layout system: store capped `windowTop`, update it on window scroll, and feed a computed height into the compose details pane. Keep the change local to `Dashboard.vue`, `Compose.vue`, and one shell regression test.

**Tech Stack:** Vue 3 single-file components, scoped SCSS, existing shell/Python grep tests.

---

## File Structure

- Modify: `frontend/src/pages/Dashboard.vue`
  - Add a visible `Stacks` heading above the compose button in the desktop stack pane.
  - Add a tiny style for the heading so it matches the pane layout without touching translations.
- Modify: `frontend/src/pages/Compose.vue`
  - Add `windowTop` state and `detailsPaneStyle`.
  - Add/remove a window scroll listener.
  - Apply sticky, scrollable details-pane CSS on desktop and disable it in stacked/mobile layouts.
- Create: `extra/tests/compose-details-sticky-scroll.test.sh`
  - Verify the left heading exists.
  - Verify `Compose.vue` uses the same capped scroll-height pattern and sticky details pane.

### Task 1: Regression Test

**Files:**
- Create: `extra/tests/compose-details-sticky-scroll.test.sh`

- [ ] **Step 1: Add the failing test**

```bash
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bash extra/tests/compose-details-sticky-scroll.test.sh
```

Expected: `FAIL: desktop stack pane must have a matching Stacks heading`

### Task 2: Minimal UI Change

**Files:**
- Modify: `frontend/src/pages/Dashboard.vue`
- Modify: `frontend/src/pages/Compose.vue`

- [ ] **Step 1: Add the left stack heading**

In `frontend/src/pages/Dashboard.vue`, replace the stack-pane header block:

```vue
<div>
    <router-link to="/compose" class="btn btn-primary mb-3"><font-awesome-icon icon="plus" /> {{ $t("compose") }}</router-link>
</div>
<StackList :scrollbar="true" />
```

with:

```vue
<h2 class="stack-pane-title mb-3">Stacks</h2>
<div>
    <router-link to="/compose" class="btn btn-primary mb-3"><font-awesome-icon icon="plus" /> {{ $t("compose") }}</router-link>
</div>
<StackList :scrollbar="true" />
```

Add this style under `.stack-pane`:

```scss
.stack-pane-title {
    font-size: 1.5rem;
    line-height: 1.2;
}
```

- [ ] **Step 2: Add sticky details-pane state and style**

In `frontend/src/pages/Compose.vue`, add `windowTop` to `data()`:

```js
windowTop: 0,
```

Add this computed property after `showCombinedTerminalPanel()`:

```js
detailsPaneStyle() {
    const style = {
        width: `${this.detailsPaneWidth}px`,
    };

    if (window.innerWidth > 550) {
        style.height = `calc(100vh - 160px + ${this.windowTop}px)`;
    } else {
        style.height = "calc(100vh - 160px)";
    }

    return style;
},
```

Change the details pane binding from:

```vue
:style="{ width: `${detailsPaneWidth}px` }"
```

to:

```vue
:style="detailsPaneStyle"
```

Add/remove the scroll listener beside the existing resize listener:

```js
window.addEventListener("scroll", this.onScroll);
```

```js
window.removeEventListener("scroll", this.onScroll);
```

Add this method before `updateWindowWidth()`:

```js
onScroll() {
    if (window.top.scrollY <= 133) {
        this.windowTop = window.top.scrollY;
    } else {
        this.windowTop = 133;
    }
},
```

Update `.compose-details-pane`:

```scss
.compose-details-pane {
    flex: 0 0 auto;
    min-width: 0;
    overflow-y: auto;
    padding-left: 12px;
    position: sticky;
    top: 10px;
}
```

In both stacked/mobile `.compose-details-pane` rules, keep the desktop behavior off:

```scss
.compose-details-pane {
    height: auto !important;
    overflow-y: visible;
    padding-left: 0;
    position: static;
    width: auto !important;
}
```

- [ ] **Step 3: Run the focused regression test**

Run:

```bash
bash extra/tests/compose-details-sticky-scroll.test.sh
```

Expected: `PASS compose-details-sticky-scroll`

- [ ] **Step 4: Run the smallest existing layout checks**

Run:

```bash
bash extra/tests/compose-bottom-terminal-panel.test.sh
bash extra/tests/container-card-layout.test.sh
pnpm run check-ts
```

Expected:

```text
PASS compose-bottom-terminal-panel
PASS container-card-layout
```

`pnpm run check-ts` should exit `0`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Dashboard.vue frontend/src/pages/Compose.vue extra/tests/compose-details-sticky-scroll.test.sh docs/superpowers/plans/2026-06-25-compose-details-sticky-scroll.md
git commit -m "fix: align compose details pane scrolling"
```
