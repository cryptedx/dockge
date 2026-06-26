# Updater Old New Diff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show current and target image digests side by side.

**Architecture:** Extend `MaintenanceService` with display helpers instead of duplicating formatting in Vue. Keep the table dense and use existing digest fields.

**Tech Stack:** TypeScript, Vue, local assert tests.

---

### Task 1: Add Display Helpers

**Files:**
- Modify: `frontend/src/util-maintenance.ts`
- Modify: `frontend/src/pages/Maintenance.vue`
- Test: `frontend/src/util-maintenance.test.ts`
- Test: `frontend/src/pages/maintenance-page.test.ts`

- [ ] **Step 1: Write failing tests**

Assert `getMaintenanceCurrentImage()` uses the first local digest and `getMaintenanceTargetImage()` uses the remote digest.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx frontend/src/util-maintenance.test.ts`
Expected: FAIL because the helpers do not exist.

- [ ] **Step 3: Implement minimal UI**

Add the helpers and render `Current Image` plus `New Image` columns. Keep `getMaintenanceDisplayImage()` as the target image alias for existing callers.

- [ ] **Step 4: Run focused tests**

Run: `pnpm exec tsx frontend/src/util-maintenance.test.ts && pnpm exec tsx frontend/src/pages/maintenance-page.test.ts`
Expected: PASS.

**Subagent decision:** No worker subagent. This touches the same helper/table files as several other plans.

