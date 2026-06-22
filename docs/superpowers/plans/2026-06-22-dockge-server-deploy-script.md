# Dockge Server Deploy Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-side deployment script that updates the custom Dockge checkout, builds the Docker image, and restarts the live Dockge compose project.

**Architecture:** A single Bash script in `extra/` owns deployment orchestration. A small Bash test verifies help and dry-run behavior without requiring Docker.

**Tech Stack:** Bash, Git, Docker CLI, Docker Compose v2.

---

### Task 1: Deploy Script

**Files:**
- Create: `extra/tests/deploy-custom-dockge.test.sh`
- Create: `extra/deploy-custom-dockge.sh`

- [ ] Write a failing test for `--help` and `--dry-run`.
- [ ] Implement the deploy script with configurable paths and safety checks.
- [ ] Run the Bash test and syntax check.
- [ ] Verify `git status --short` contains only intended files.

