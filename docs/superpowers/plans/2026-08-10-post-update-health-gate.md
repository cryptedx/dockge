# Post-Update Health Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require running stack updates to reach Docker Compose's running or healthy state before Dockge reports success.

**Architecture:** Add Compose-native `--wait` arguments in the shared `Stack.update()` runtime path and retain the existing Maintenance digest verification afterward. Give only proxied update events a longer acknowledgement window so pulls plus the bounded health wait do not hit the normal agent timeout.

**Tech Stack:** TypeScript, Node.js assert tests, Docker Compose V2, Socket.IO, pnpm

## Global Constraints

- The Compose health wait is exactly 60 seconds.
- Proxied `updateStack`, `applyStackUpdates`, and `applyStackServiceUpdates` calls receive exactly 180 seconds; every other proxied event remains at 60 seconds.
- Stopped stacks remain pull-only.
- Maintenance continues to require the target digest to report `current` after the health gate passes.
- Do not add automatic rollback, custom probes, settings, dependencies, healthchecks to user files, or unrelated UI.
- Do not change the current Maintenance behavior of continuing the queue after one job fails.
- Preserve the existing untracked `docs/superpowers/plans/2026-06-25-terminal-visible-refit.md` file.

## File Structure

- Modify `backend/stack.ts`: build and use the health-gated Compose `up` arguments.
- Create `backend/stack.test.ts`: assert the exact health-gated update invocation without importing the native PTY dependency.
- Modify `backend/agent-manager.ts`: select the acknowledgement timeout from the proxied event name.
- Modify `backend/agent-manager.test.ts`: cover default and update-event timeouts, including timeout error text.

---

### Task 1: Implement the Shared Post-Update Health Gate

**Files:**
- Modify: `backend/stack.ts:553-584`
- Create: `backend/stack.test.ts`
- Modify: `backend/agent-manager.ts:10-11,278-299`
- Modify: `backend/agent-manager.test.ts`

**Interfaces:**
- Consumes: `Stack.update(socket: DockgeSocket, serviceNames: string[])`, `AgentManager.emitToEndpoint(endpoint: string, eventName: string, ...args: unknown[])`, and Docker Compose `up --wait --wait-timeout`.
- Produces: health-gated Compose arguments in the shared `Stack.update()` runtime call; update-event acknowledgement timeouts of 180 seconds; unchanged 60-second timeouts for other events.

- [ ] **Step 1: Add failing command-argument tests**

Create `backend/stack.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./stack.ts", import.meta.url), "utf-8");

assert.match(
    source,
    /this\.getComposeOptions\("up", "-d", "--remove-orphans", "--wait", "--wait-timeout", "60", \.\.\.serviceNames\)/
);
```

- [ ] **Step 2: Add failing agent-timeout tests**

Keep the existing `checkStackUpdates` success and timeout assertions in `backend/agent-manager.test.ts`. Append this update-event coverage after them:

```ts
for (const eventName of [ "updateStack", "applyStackUpdates", "applyStackServiceUpdates" ]) {
    let requestedTimeout = 0;
    let response: unknown;

    await managerWithClient({
        connected: true,
        timeout(ms) {
            requestedTimeout = ms;
            return this;
        },
        emit(event, endpoint, forwardedEvent, stackName, callback) {
            assert.equal(event, "agent");
            assert.equal(endpoint, "agent.local");
            assert.equal(forwardedEvent, eventName);
            assert.equal(stackName, "example");
            (callback as Ack)(null, { ok: true });
        },
    }).emitToEndpoint("agent.local", eventName, "example", (res: unknown) => {
        response = res;
    });

    assert.equal(requestedTimeout, 180_000);
    assert.deepEqual(response, { ok: true });
}

let updateTimeoutResponse: unknown;
await managerWithClient({
    connected: true,
    timeout(ms) {
        assert.equal(ms, 180_000);
        return this;
    },
    emit(event, endpoint, eventName, stackName, callback) {
        assert.equal(event, "agent");
        assert.equal(endpoint, "agent.local");
        assert.equal(eventName, "applyStackServiceUpdates");
        assert.equal(stackName, "example");
        (callback as Ack)(new Error("timeout"));
    },
}).emitToEndpoint("agent.local", "applyStackServiceUpdates", "example", (res: unknown) => {
    updateTimeoutResponse = res;
});
assert.deepEqual(updateTimeoutResponse, {
    ok: false,
    msg: "agent.local: applyStackServiceUpdates timed out after 180s",
});
```

- [ ] **Step 3: Run the focused tests and confirm they fail for the intended reasons**

Run:

```bash
env TMPDIR=/private/tmp pnpm exec tsx backend/stack.test.ts
env TMPDIR=/private/tmp pnpm exec tsx backend/agent-manager.test.ts
```

Expected:

- `backend/stack.test.ts` fails because the shared runtime update call does not contain `--wait --wait-timeout 60`.
- `backend/agent-manager.test.ts` fails because update events still receive 60,000 ms.

- [ ] **Step 4: Implement the minimal health-gated Compose arguments**

Replace the runtime `up` invocation inside `Stack.update()` with:

```ts
exitCode = await Terminal.exec(
    this.server,
    socket,
    terminalName,
    "docker",
    this.getComposeOptions("up", "-d", "--remove-orphans", "--wait", "--wait-timeout", "60", ...serviceNames),
    this.path
);
```

Do not change `deploy()`, `start()`, the stopped-stack early return, digest checks, or rollback behavior.

- [ ] **Step 5: Implement event-specific agent timeouts**

Replace the single timeout constant at the top of `backend/agent-manager.ts` with:

```ts
const AGENT_REQUEST_TIMEOUT_MS = 60_000;
const AGENT_UPDATE_REQUEST_TIMEOUT_MS = 180_000;
const AGENT_UPDATE_EVENTS = new Set([ "updateStack", "applyStackUpdates", "applyStackServiceUpdates" ]);
```

In the callback branch of `emitToEndpoint()`, select and consistently use the timeout:

```ts
const requestTimeoutMs = AGENT_UPDATE_EVENTS.has(eventName)
    ? AGENT_UPDATE_REQUEST_TIMEOUT_MS
    : AGENT_REQUEST_TIMEOUT_MS;

client.timeout(requestTimeoutMs).emit("agent", endpoint, eventName, ...eventArgs, (err: Error | null, ...callbackArgs: unknown[]) => {
    if (err) {
        callback({
            ok: false,
            msg: `${endpoint}: ${eventName} timed out after ${requestTimeoutMs / 1000}s`,
        });
        return;
    }
    callback(...callbackArgs);
});
```

- [ ] **Step 6: Run the focused regression tests**

Run:

```bash
env TMPDIR=/private/tmp pnpm exec tsx backend/stack.test.ts
env TMPDIR=/private/tmp pnpm exec tsx backend/agent-manager.test.ts
env TMPDIR=/private/tmp pnpm exec tsx backend/update-planner.test.ts
```

Expected: all three commands exit zero.

- [ ] **Step 7: Run the local verification suite**

Run:

```bash
pnpm run check-ts
pnpm run lint
git diff --check
pnpm run build:frontend
```

Expected: every command exits zero. Only the four intended implementation/test files and this corrected plan are changed; the pre-existing untracked terminal plan remains untouched.

- [ ] **Step 8: Commit the implementation**

```bash
git add backend/stack.ts backend/stack.test.ts backend/agent-manager.ts backend/agent-manager.test.ts docs/superpowers/plans/2026-08-10-post-update-health-gate.md
git commit -m "feat: wait for healthy stack updates"
```

---

### Task 2: Deploy and Verify Both Success and Failure Paths

**Files:**
- Temporary local fixture: `/private/tmp/dockge-health-gate-compose.yaml`
- Temporary remote stack: `/opt/stacks/dockge-health-gate-test/compose.yaml`

**Interfaces:**
- Consumes: committed `Stack.update()` health gate, the Maintenance UI, `docker-main`, and Frigate LXC 106.
- Produces: live proof that a healthy update completes, an unhealthy update fails, and both Dockge instances run the same image.

- [ ] **Step 1: Push and deploy the committed branch to `docker-main`**

```bash
git push origin master
ssh docker-main 'cd /opt/dockge-custom && git fetch origin master && git checkout master && git pull --ff-only origin master && docker build --target release -t dockge:master -f docker/Dockerfile . && cd /opt/dockge && docker compose up -d'
```

- [ ] **Step 2: Transfer the image to Frigate LXC and recreate Dockge**

```bash
ssh docker-main 'docker save dockge:master | gzip -1' | ssh pve-alt 'pct exec 106 -- sh -c "gunzip | docker load"'
ssh pve-alt 'pct exec 106 -- sh -c "cd /opt/dockge && docker compose up -d --force-recreate"'
```

- [ ] **Step 3: Verify both live instances before feature testing**

```bash
ssh docker-main 'docker ps --filter name=dockge-main --format "{{.Names}} {{.Image}} {{.Status}}" && curl -fsS http://127.0.0.1:5001 >/dev/null'
ssh docker-main 'docker image inspect dockge:master --format "{{.Id}}"'
ssh pve-alt 'pct exec 106 -- sh -c "docker image inspect dockge:master --format \"{{.Id}}\" && docker inspect dockge-frigate --format \"{{.Image}} {{.State.Health.Status}}\""'
```

Expected: both containers are healthy and both image IDs match.

- [ ] **Step 4: Create an isolated healthy update candidate without retagging shared images**

Pull the older Alpine image and capture its repository digest:

```bash
health_gate_old_digest=$(ssh docker-main 'docker pull alpine:3.19 >/dev/null && docker image inspect alpine:3.19 --format "{{index .RepoDigests 0}}"' | sed 's/.*@//')
test -n "$health_gate_old_digest"
```

Use `apply_patch` to create `/private/tmp/dockge-health-gate-compose.yaml` with this content:

```yaml
services:
  healthy:
    image: alpine:3.20@HEALTH_GATE_OLD_DIGEST
    command: ["sleep", "300"]
    healthcheck:
      test: ["CMD", "true"]
      interval: 1s
      timeout: 1s
      retries: 3
```

Replace the sentinel mechanically, create the exact remote test directory, copy the file, and start the pinned old digest:

```bash
sed -i.bak "s/HEALTH_GATE_OLD_DIGEST/$health_gate_old_digest/" /private/tmp/dockge-health-gate-compose.yaml
ssh docker-main 'mkdir -p /opt/stacks/dockge-health-gate-test'
scp /private/tmp/dockge-health-gate-compose.yaml docker-main:/opt/stacks/dockge-health-gate-test/compose.yaml
ssh docker-main 'cd /opt/stacks/dockge-health-gate-test && docker compose up -d --wait --wait-timeout 30'
```

Expected: the disposable service is healthy while its pinned digest differs from the current `alpine:3.20` registry digest.

- [ ] **Step 5: Verify a healthy Maintenance update**

In Dockge:

1. Run **Scan Stacks Folder** so `dockge-health-gate-test` is managed.
2. Open **Maintenance** and run **Scan All Agents**.
3. Search for `dockge-health-gate-test` and select only service `healthy`.
4. Run **Update Selected**.

Expected:

- Terminal output shows Compose waiting for the service.
- The queue job reaches `done` only after the container is healthy and the target digest verifies as `current`.
- The row disappears from the default **Updates Only** view.

- [ ] **Step 6: Reconfigure the disposable stack for an unhealthy update**

Capture the digest used by the disposable healthy service rather than relying on a global image tag:

```bash
health_gate_current_digest=$(ssh docker-main 'cd /opt/stacks/dockge-health-gate-test && docker image inspect "$(docker compose images -q healthy)" --format "{{index .RepoDigests 0}}"' | sed 's/.*@//')
test -n "$health_gate_current_digest"
```

Use `apply_patch` to replace `/private/tmp/dockge-health-gate-compose.yaml` with:

```yaml
services:
  unhealthy:
    image: alpine:edge@HEALTH_GATE_CURRENT_DIGEST
    command: ["sleep", "300"]
    healthcheck:
      test: ["CMD", "false"]
      interval: 1s
      timeout: 1s
      retries: 1
```

Replace the sentinel, copy the new Compose file, and start it without a wait so Maintenance has an updateable unhealthy service:

```bash
sed -i.bak "s/HEALTH_GATE_CURRENT_DIGEST/$health_gate_current_digest/" /private/tmp/dockge-health-gate-compose.yaml
scp /private/tmp/dockge-health-gate-compose.yaml docker-main:/opt/stacks/dockge-health-gate-test/compose.yaml
ssh docker-main 'cd /opt/stacks/dockge-health-gate-test && docker compose up -d'
```

- [ ] **Step 7: Verify the unhealthy Maintenance update fails**

In Dockge Maintenance:

1. Run a fresh scan.
2. Search for `dockge-health-gate-test` and select only service `unhealthy`.
3. Run **Update Selected**.

Expected after at most 60 seconds:

- Compose returns a non-zero result because the service does not become healthy.
- The queue job is `failed`, never `done`.
- Terminal output remains visible.
- The remaining queue behavior is unchanged.

- [ ] **Step 8: Remove only the disposable test stack and fixture**

```bash
ssh docker-main 'cd /opt/stacks/dockge-health-gate-test && docker compose down --remove-orphans'
ssh docker-main 'rm -rf /opt/stacks/dockge-health-gate-test'
```

Delete the two exact temporary files, then run **Scan Stacks Folder** once more and confirm `dockge-health-gate-test` is gone:

```bash
rm /private/tmp/dockge-health-gate-compose.yaml /private/tmp/dockge-health-gate-compose.yaml.bak
```

- [ ] **Step 9: Record final repository and live evidence**

```bash
git status --short --branch
git log -3 --oneline
ssh docker-main 'docker ps --filter name=dockge-main --format "{{.Names}} {{.Image}} {{.Status}}"'
ssh pve-alt 'pct exec 106 -- docker ps --filter name=dockge-frigate --format "{{.Names}} {{.Image}} {{.Status}}"'
```

Expected: only the pre-existing untracked terminal plan remains locally, and both Dockge containers are healthy on `dockge:master`.
