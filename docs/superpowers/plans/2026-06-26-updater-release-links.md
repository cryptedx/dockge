# Updater Release Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a simple image registry link for update rows.

**Architecture:** Generate deterministic links from normalized image references. Do not scrape changelogs or call extra APIs.

**Tech Stack:** TypeScript, Vue, local assert tests.

---

### Task 1: Generate Registry Links

**Files:**
- Modify: `backend/update-planner.ts`
- Modify: `frontend/src/util-maintenance.ts`
- Modify: `frontend/src/pages/Maintenance.vue`
- Test: `backend/update-planner.test.ts`
- Test: `frontend/src/util-maintenance.test.ts`

- [ ] **Step 1: Write failing tests**

Assert Docker Hub links become `https://hub.docker.com/r/library/nginx/tags` and GHCR links become `https://github.com/example/app/pkgs/container/app`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec tsx backend/update-planner.test.ts && pnpm exec tsx frontend/src/util-maintenance.test.ts`
Expected: FAIL because link helpers are missing.

- [ ] **Step 3: Implement link helper**

Export `getImageRegistryUrl(image)` from `backend/update-planner.ts`, attach `registryUrl` to scan services, and render one external link in Maintenance.

- [ ] **Step 4: Run focused tests**

Run: `pnpm exec tsx backend/update-planner.test.ts && pnpm exec tsx frontend/src/util-maintenance.test.ts`
Expected: PASS.

**Subagent decision:** Explorer subagent only. Backend URL rules are independent enough to review, but implementation is small.

