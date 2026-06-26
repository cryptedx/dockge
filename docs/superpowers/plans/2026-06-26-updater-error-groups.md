# Updater Error Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace vague `Unknown` reasons with compact categories.

**Architecture:** Categorize existing error text in one helper. Do not introduce a registry-specific error taxonomy beyond the strings Dockge already sees.

**Tech Stack:** TypeScript, Vue, local assert tests.

---

### Task 1: Categorize Unknown Reasons

**Files:**
- Modify: `backend/update-planner.ts`
- Modify: `backend/stack.ts`
- Modify: `frontend/src/util-maintenance.ts`
- Modify: `frontend/src/pages/Maintenance.vue`
- Test: `backend/update-planner.test.ts`
- Test: `frontend/src/util-maintenance.test.ts`

- [ ] **Step 1: Write failing tests**

Assert timeout, auth, local digest, manifest missing, and generic failure strings map to stable categories.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec tsx backend/update-planner.test.ts && pnpm exec tsx frontend/src/util-maintenance.test.ts`
Expected: FAIL because categories are missing.

- [ ] **Step 3: Implement categories**

Export `categorizeUpdateReason()` and attach `reasonCategory` to services. Render the category as a small badge next to the reason.

- [ ] **Step 4: Run focused tests**

Run: `pnpm exec tsx backend/update-planner.test.ts && pnpm exec tsx frontend/src/util-maintenance.test.ts`
Expected: PASS.

**Subagent decision:** Explorer subagent only. The mapping is easy, but backend/frontend type shape must be checked.

