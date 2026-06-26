# Updater Batch Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add quick filters for old images, unknown rows, and selected rows.

**Architecture:** Keep filters client-side in computed properties. Do not add saved filter presets.

**Tech Stack:** Vue, TypeScript helpers, local assert tests.

---

### Task 1: Add Filter Helpers

**Files:**
- Modify: `frontend/src/util-maintenance.ts`
- Modify: `frontend/src/pages/Maintenance.vue`
- Test: `frontend/src/util-maintenance.test.ts`
- Test: `frontend/src/pages/maintenance-page.test.ts`

- [ ] **Step 1: Write failing tests**

Assert `isMaintenanceImageOlderThanDays()` handles missing dates, invalid dates, and valid old images.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx frontend/src/util-maintenance.test.ts`
Expected: FAIL because the helper is missing.

- [ ] **Step 3: Implement filters**

Add an image age select, an unknown toggle, and a selected-only toggle. Apply them in `filteredRows()`.

- [ ] **Step 4: Run focused tests**

Run: `pnpm exec tsx frontend/src/util-maintenance.test.ts && pnpm exec tsx frontend/src/pages/maintenance-page.test.ts`
Expected: PASS.

**Subagent decision:** No worker subagent. This is tightly coupled to the Maintenance table state.

