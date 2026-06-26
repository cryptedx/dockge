# Updater Dry Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user build and inspect the update queue without executing it.

**Architecture:** Add a UI-only dry-run flag. It builds the same queue and marks jobs as preview instead of calling `applyStackServiceUpdates`.

**Tech Stack:** Vue, TypeScript helpers, local assert tests.

---

### Task 1: Preview Queue Without Updates

**Files:**
- Modify: `frontend/src/util-maintenance.ts`
- Modify: `frontend/src/pages/Maintenance.vue`
- Test: `frontend/src/util-maintenance.test.ts`
- Test: `frontend/src/pages/maintenance-page.test.ts`

- [ ] **Step 1: Write failing tests**

Assert `markMaintenanceQueuePreview()` returns queue jobs with `status: "preview"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx frontend/src/util-maintenance.test.ts`
Expected: FAIL because preview status is missing.

- [ ] **Step 3: Implement dry-run UI**

Add a Dry run checkbox near the batch action. In dry-run mode, build the queue, set preview status, clear selected rows, and skip network calls.

- [ ] **Step 4: Run focused tests**

Run: `pnpm exec tsx frontend/src/util-maintenance.test.ts && pnpm exec tsx frontend/src/pages/maintenance-page.test.ts`
Expected: PASS.

**Subagent decision:** No worker subagent. It modifies the same queue code as history.

