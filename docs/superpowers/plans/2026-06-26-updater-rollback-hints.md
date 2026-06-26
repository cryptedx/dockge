# Updater Rollback Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the old image digest visible as a rollback hint after updates.

**Architecture:** Use existing local digest data and history records. Do not implement automatic rollback.

**Tech Stack:** TypeScript, Vue, local assert tests.

---

### Task 1: Add Rollback Hint Text

**Files:**
- Modify: `frontend/src/util-maintenance.ts`
- Modify: `frontend/src/pages/Maintenance.vue`
- Test: `frontend/src/util-maintenance.test.ts`

- [ ] **Step 1: Write failing tests**

Assert `getMaintenanceRollbackHint()` returns `docker compose pull <service> && docker compose up -d <service>` only when an old digest is known.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx frontend/src/util-maintenance.test.ts`
Expected: FAIL because rollback helper is missing.

- [ ] **Step 3: Implement hint**

Show the old digest and a short rollback command hint in the row details/title. Keep it informational.

- [ ] **Step 4: Run focused test**

Run: `pnpm exec tsx frontend/src/util-maintenance.test.ts`
Expected: PASS.

**Subagent decision:** No worker subagent. This is one helper plus one table cell.

