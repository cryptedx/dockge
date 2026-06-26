# Updater History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remember the last update action per service locally.

**Architecture:** Store a small `localStorage` map keyed by maintenance row key. Update it when each queue job finishes.

**Tech Stack:** TypeScript, Vue, browser localStorage, local assert tests.

---

### Task 1: Add Local History

**Files:**
- Modify: `frontend/src/util-maintenance.ts`
- Modify: `frontend/src/pages/Maintenance.vue`
- Test: `frontend/src/util-maintenance.test.ts`
- Test: `frontend/src/pages/maintenance-page.test.ts`

- [ ] **Step 1: Write failing tests**

Assert `recordMaintenanceHistory()` records `status`, `checkedAt`, and `error`, and `getMaintenanceHistoryLabel()` returns compact text.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx frontend/src/util-maintenance.test.ts`
Expected: FAIL because history helpers are missing.

- [ ] **Step 3: Implement local history**

Add `MAINTENANCE_HISTORY_KEY`, parse/record helpers, load history on mount, and update history after queue jobs finish.

- [ ] **Step 4: Run focused tests**

Run: `pnpm exec tsx frontend/src/util-maintenance.test.ts && pnpm exec tsx frontend/src/pages/maintenance-page.test.ts`
Expected: PASS.

**Subagent decision:** No worker subagent. It shares the same Maintenance state and template as dry-run and filters.

