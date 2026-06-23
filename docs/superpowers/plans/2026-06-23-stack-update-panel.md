# Stack Update Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stack-level Updates panel that scans compose service images, shows update status, and applies selected updates.

**Architecture:** Keep update detection in a small backend module that uses Docker/registry facts, then expose two agent socket events from the existing Dockge stack handler. Reuse the existing terminal execution path for pull/up so output still appears in Dockge.

**Tech Stack:** TypeScript, Node `fetch`, Docker CLI, Vue 3 Options API, existing Bootstrap styles.

---

### Task 1: Backend Update Planner

**Files:**
- Create: `backend/update-planner.ts`
- Create: `backend/update-planner.test.ts`

- [ ] Add tests for image reference normalization, Docker Hub defaults, and local-vs-remote digest comparison.
- [ ] Run `pnpm exec tsx backend/update-planner.test.ts` and confirm it fails because the module is missing.
- [ ] Implement only the tested parser/comparator helpers.
- [ ] Re-run the test until it passes.

### Task 2: Stack Scan and Apply Events

**Files:**
- Modify: `backend/stack.ts`
- Modify: `backend/agent-socket-handlers/docker-socket-handler.ts`

- [ ] Add `Stack.checkUpdates()` to read `docker compose config --format json`, inspect local image repo digests, and ask the planner for remote digests.
- [ ] Extend `Stack.update(socket, serviceNames?)` so selected services use `docker compose pull SERVICE...` and `docker compose up -d --remove-orphans SERVICE...`.
- [ ] Add socket events `checkStackUpdates` and `applyStackUpdates`.
- [ ] Run `pnpm run check-ts`.

### Task 3: Stack Updates UI

**Files:**
- Modify: `frontend/src/pages/Compose.vue`

- [ ] Add a non-edit-mode Updates tab/section in the stack details pane.
- [ ] Add scan, selected-service update, loading, error, empty, and unsupported states.
- [ ] Keep the existing Update button behavior available.
- [ ] Run `pnpm run check-ts`.

### Task 4: Final Verification

**Files:**
- All modified files

- [ ] Run `pnpm exec tsx backend/update-planner.test.ts`.
- [ ] Run `pnpm run check-ts`.
- [ ] Review `git diff --check`.
- [ ] Commit only files changed in this worktree.
