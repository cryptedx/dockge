# Compose Bottom Terminal Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the combined stack terminal out of the narrow right details pane into a full-width bottom panel under the compose workbench.

**Architecture:** Keep `Compose.vue` as the owner of the combined terminal binding. Wrap the existing editor/details split in a `compose-workspace`, keep the split in `compose-workbench`, and render a separate `compose-terminal-panel` after the split when not editing.

**Tech Stack:** Vue SFC, scoped SCSS, existing `Terminal` component, Bash regression tests.

---

### Task 1: Protect The New Terminal Layout

**Files:**
- Create: `extra/tests/compose-bottom-terminal-panel.test.sh`
- Modify: `frontend/src/pages/Compose.vue`

- [ ] **Step 1: Write the failing test**

Create `extra/tests/compose-bottom-terminal-panel.test.sh` to assert that `Compose.vue` contains `compose-terminal-panel`, keeps `combinedTerminal` outside the `compose-details-pane`, and exposes a collapse button.

- [ ] **Step 2: Run test to verify it fails**

Run: `bash extra/tests/compose-bottom-terminal-panel.test.sh`
Expected: FAIL because the current combined terminal still lives inside the details pane.

- [ ] **Step 3: Move the terminal panel**

Change `frontend/src/pages/Compose.vue` so the existing terminal section is removed from the details pane and rendered after the split layout as a `section.compose-terminal-panel` with a header, collapse button, and full-width terminal body.

- [ ] **Step 4: Style the panel**

Add scoped SCSS for `compose-workspace`, `compose-terminal-panel`, header, collapsed state, and full-width terminal height. Keep the right details pane focused on containers and extra stack details only.

- [ ] **Step 5: Verify and commit**

Run:
`bash extra/tests/compose-bottom-terminal-panel.test.sh`
`npm run check-ts`
`npm run build:frontend`
`./node_modules/.bin/eslint frontend/src/pages/Compose.vue`
