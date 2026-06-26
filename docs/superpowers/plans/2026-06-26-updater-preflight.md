# Updater Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a compact preflight result before stack updates run.

**Architecture:** Reuse the existing stack update path and add one backend helper that checks compose config, stack status, and disk space. Surface the result in the maintenance scan rows so the user sees warnings before selecting updates.

**Tech Stack:** TypeScript, Docker CLI, Vue, local assert tests.

---

### Task 1: Add Preflight Data

**Files:**
- Modify: `backend/update-planner.ts`
- Modify: `backend/stack.ts`
- Test: `backend/update-planner.test.ts`

- [ ] **Step 1: Write failing tests**

Add assertions for `summarizePreflight()` returning `ok`, `warning`, and `failed`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx backend/update-planner.test.ts`
Expected: FAIL because `summarizePreflight` is not exported.

- [ ] **Step 3: Implement minimal backend helper**

Add exported preflight types plus `summarizePreflight(checks)` in `backend/update-planner.ts`, then call it from `Stack.checkUpdates()` using existing Docker commands.

- [ ] **Step 4: Run focused test**

Run: `pnpm exec tsx backend/update-planner.test.ts`
Expected: PASS.

**Subagent decision:** No worker subagent. This is coupled to the backend metadata shape used by all following plans.

