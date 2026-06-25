# Global Maintenance Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a global Maintenance page that scans every Dockge agent, lets users select exact updateable services, and applies selected updates globally sequentially.

**Architecture:** Reuse the stack-local update backend already on `codex/update-panel`. Add one agent-side all-stack scan event, one selected-stack apply event, and one frontend Maintenance page with pure selection/queue helpers tested by assert-based TypeScript tests.

**Tech Stack:** TypeScript, Vue 3 Options API, existing Socket.IO agent proxy, existing Bootstrap/Dockge styles, `tsx` assert tests.

---

## File Structure

- Create `frontend/src/pages/Maintenance.vue`: global scan table, filters, selection, confirmation modal, sequential queue UI.
- Create `frontend/src/util-maintenance.ts`: pure helpers for flattening scan results, selection grouping, summary counts, and queue creation.
- Create `frontend/src/util-maintenance.test.ts`: assert-based tests for selection and queue ordering.
- Modify `frontend/src/router.ts`: add `/maintenance` route.
- Modify `frontend/src/layouts/Layout.vue`: add top-nav Maintenance link.
- Modify `backend/agent-socket-handlers/docker-socket-handler.ts`: add all-stack scan/apply events.
- Modify `backend/stack.ts` only if a small helper is needed for all-stack scanning. Prefer existing `Stack.getStackList()` and `Stack.checkUpdates()`.

## Task 1: Pure Maintenance Helpers

**Files:**
- Create: `frontend/src/util-maintenance.ts`
- Create: `frontend/src/util-maintenance.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `frontend/src/util-maintenance.test.ts`:

```ts
import assert from "node:assert/strict";
import {
    buildMaintenanceQueue,
    flattenMaintenanceScan,
    getMaintenanceSummary,
} from "./util-maintenance";

const scans = [
    {
        endpoint: "",
        name: "Current",
        ok: true,
        stacks: [
            {
                name: "media",
                services: [
                    { service: "plex", image: "plex:latest", status: "update-available" },
                    { service: "db", image: "postgres:16", status: "current" },
                ],
            },
        ],
    },
    {
        endpoint: "tcp://agent:5001",
        name: "Agent",
        ok: true,
        stacks: [
            {
                name: "tools",
                services: [
                    { service: "wiki", image: "wiki:latest", status: "update-available" },
                    { service: "cache", image: "redis:7", status: "unknown", reason: "No local repo digest found" },
                ],
            },
        ],
    },
];

const rows = flattenMaintenanceScan(scans);
assert.equal(rows.length, 4);
assert.equal(rows[0].key, "_media_plex");
assert.equal(rows[2].key, "tcp://agent:5001_tools_wiki");

assert.deepEqual(getMaintenanceSummary(rows, scans), {
    agents: 2,
    failedAgents: 0,
    stacks: 2,
    services: 4,
    updates: 2,
    unknown: 1,
});

assert.deepEqual(buildMaintenanceQueue(rows, {
    "_media_plex": true,
    "tcp://agent:5001_tools_wiki": true,
    "tcp://agent:5001_tools_cache": true,
}), [
    {
        endpoint: "",
        agentName: "Current",
        stackName: "media",
        serviceNames: [ "plex" ],
        status: "queued",
    },
    {
        endpoint: "tcp://agent:5001",
        agentName: "Agent",
        stackName: "tools",
        serviceNames: [ "wiki" ],
        status: "queued",
    },
]);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
env TMPDIR=/private/tmp pnpm exec tsx frontend/src/util-maintenance.test.ts
```

Expected: FAIL because `frontend/src/util-maintenance.ts` does not exist.

- [ ] **Step 3: Implement minimal helpers**

Create `frontend/src/util-maintenance.ts`:

```ts
export type MaintenanceStatus = "current" | "update-available" | "unknown";
export type MaintenanceJobStatus = "queued" | "running" | "done" | "failed";

export interface MaintenanceService {
    service: string;
    image: string;
    status: MaintenanceStatus;
    reason?: string;
}

export interface MaintenanceScan {
    endpoint: string;
    name: string;
    ok: boolean;
    error?: string;
    stacks: Array<{
        name: string;
        services: MaintenanceService[];
    }>;
}

export interface MaintenanceRow extends MaintenanceService {
    key: string;
    endpoint: string;
    agentName: string;
    stackName: string;
    selectable: boolean;
}

export interface MaintenanceUpdateJob {
    endpoint: string;
    agentName: string;
    stackName: string;
    serviceNames: string[];
    status: MaintenanceJobStatus;
    error?: string;
}

export function maintenanceKey(endpoint: string, stackName: string, serviceName: string) {
    return `${endpoint}_${stackName}_${serviceName}`;
}

export function flattenMaintenanceScan(scans: MaintenanceScan[]): MaintenanceRow[] {
    return scans.flatMap((scan) => scan.stacks.flatMap((stack) => stack.services.map((service) => ({
        ...service,
        key: maintenanceKey(scan.endpoint, stack.name, service.service),
        endpoint: scan.endpoint,
        agentName: scan.name,
        stackName: stack.name,
        selectable: service.status === "update-available",
    }))));
}

export function getMaintenanceSummary(rows: MaintenanceRow[], scans: MaintenanceScan[]) {
    return {
        agents: scans.length,
        failedAgents: scans.filter((scan) => !scan.ok).length,
        stacks: new Set(rows.map((row) => `${row.endpoint}_${row.stackName}`)).size,
        services: rows.length,
        updates: rows.filter((row) => row.status === "update-available").length,
        unknown: rows.filter((row) => row.status === "unknown").length,
    };
}

export function buildMaintenanceQueue(rows: MaintenanceRow[], selected: Record<string, boolean>): MaintenanceUpdateJob[] {
    const jobs = new Map<string, MaintenanceUpdateJob>();

    for (const row of rows) {
        if (!selected[row.key] || !row.selectable) {
            continue;
        }

        const jobKey = `${row.endpoint}_${row.stackName}`;
        if (!jobs.has(jobKey)) {
            jobs.set(jobKey, {
                endpoint: row.endpoint,
                agentName: row.agentName,
                stackName: row.stackName,
                serviceNames: [],
                status: "queued",
            });
        }

        jobs.get(jobKey)?.serviceNames.push(row.service);
    }

    return [ ...jobs.values() ];
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
env TMPDIR=/private/tmp pnpm exec tsx frontend/src/util-maintenance.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/util-maintenance.ts frontend/src/util-maintenance.test.ts
git commit -m "test: add maintenance selection helpers"
```

## Task 2: Backend Agent-Level Scan and Apply Events

**Files:**
- Modify: `backend/agent-socket-handlers/docker-socket-handler.ts`

- [ ] **Step 1: Add `checkAllStackUpdates`**

In `DockerSocketHandler.create()`, add an event near the existing `checkStackUpdates` event:

```ts
agentSocket.on("checkAllStackUpdates", async (callback) => {
    try {
        checkLogin(socket);

        const stackList = await Stack.getStackList(server);
        const stacks = [];

        for (const [ stackName, stack ] of stackList) {
            if (!stack.isManagedByDockge) {
                continue;
            }

            try {
                const updates = await stack.checkUpdates();
                stacks.push({
                    name: stackName,
                    services: updates.services,
                });
            } catch (e) {
                stacks.push({
                    name: stackName,
                    error: e instanceof Error ? e.message : "Update check failed",
                    services: [],
                });
            }
        }

        callbackResult({
            ok: true,
            checkedAt: new Date().toISOString(),
            stacks,
        }, callback);
    } catch (e) {
        callbackError(e, callback);
    }
});
```

- [ ] **Step 2: Add `applyStackServiceUpdates`**

Reuse the current selected stack-update validation. Add an alias event that matches the global page naming:

```ts
agentSocket.on("applyStackServiceUpdates", async (stackName : unknown, serviceNames : unknown, callback) => {
    try {
        checkLogin(socket);

        if (typeof(stackName) !== "string") {
            throw new ValidationError("Stack name must be a string");
        }
        if (!Array.isArray(serviceNames) || serviceNames.some((serviceName) => typeof serviceName !== "string" || !isComposeServiceName(serviceName))) {
            throw new ValidationError("Service names must be a valid string array");
        }
        if (serviceNames.length === 0) {
            throw new ValidationError("Select at least one service to update");
        }

        const stack = await Stack.getStack(server, stackName);
        await stack.update(socket, serviceNames);
        callbackResult({
            ok: true,
            msg: "Updated",
            msgi18n: true,
        }, callback);
        server.sendStackList();
    } catch (e) {
        callbackError(e, callback);
    }
});
```

- [ ] **Step 3: Verify typecheck**

Run:

```bash
pnpm run check-ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/agent-socket-handlers/docker-socket-handler.ts
git commit -m "feat: add global maintenance backend events"
```

## Task 3: Maintenance Page

**Files:**
- Create: `frontend/src/pages/Maintenance.vue`

- [ ] **Step 1: Create page shell**

Create `frontend/src/pages/Maintenance.vue` with:

```vue
<template>
    <transition name="slide-fade" appear>
        <div class="maintenance-page">
            <div class="maintenance-header mb-3">
                <div>
                    <h1 class="mb-1">Maintenance</h1>
                    <div class="maintenance-subtitle">Scan all agents and update selected services sequentially.</div>
                </div>
                <button class="btn btn-primary" type="button" :disabled="scanning || queueRunning" @click="scanAllAgents">
                    <font-awesome-icon icon="search" class="me-1" />
                    {{ scanning ? "Scanning" : "Scan all agents" }}
                </button>
            </div>

            <div class="maintenance-summary mb-3">
                <div v-for="item in summaryItems" :key="item.label" class="shadow-box maintenance-metric">
                    <span>{{ item.value }}</span>
                    <small>{{ item.label }}</small>
                </div>
            </div>

            <div class="shadow-box big-padding mb-3 maintenance-toolbar">
                <label class="form-check">
                    <input v-model="updatesOnly" class="form-check-input" type="checkbox" />
                    <span class="form-check-label">Updates only</span>
                </label>
                <select v-model="agentFilter" class="form-select">
                    <option value="">All agents</option>
                    <option v-for="agent in agentOptions" :key="agent.endpoint" :value="agent.endpoint">{{ agent.name }}</option>
                </select>
                <input v-model="searchText" class="form-control" type="search" placeholder="Search stack, service, image" />
            </div>

            <div class="shadow-box maintenance-table-wrap">
                <table class="table maintenance-table mb-0">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Agent</th>
                            <th>Stack</th>
                            <th>Service</th>
                            <th>Image</th>
                            <th>Status</th>
                            <th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="!scanResults.length && !scanning">
                            <td colspan="7" class="maintenance-empty">Run a scan to load update status from all agents.</td>
                        </tr>
                        <tr v-for="row in filteredRows" :key="row.key">
                            <td>
                                <input
                                    v-model="selected[row.key]"
                                    class="form-check-input"
                                    type="checkbox"
                                    :disabled="!row.selectable || queueRunning"
                                />
                            </td>
                            <td>{{ row.agentName }}</td>
                            <td>{{ row.stackName }}</td>
                            <td>{{ row.service }}</td>
                            <td class="maintenance-image">{{ row.image }}</td>
                            <td><span class="badge" :class="badgeClass(row.status)">{{ statusLabel(row.status) }}</span></td>
                            <td class="maintenance-reason">{{ row.reason || "" }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="selectedCount > 0 || queue.length > 0" class="maintenance-batch shadow-box">
                <div>
                    <strong>{{ selectedCount }}</strong> services selected across
                    <strong>{{ selectedStackCount }}</strong> stacks and
                    <strong>{{ selectedAgentCount }}</strong> agents
                </div>
                <button class="btn btn-primary" type="button" :disabled="queueRunning" @click="confirmUpdate = true">
                    <font-awesome-icon icon="cloud-arrow-down" class="me-1" />
                    Update selected
                </button>
            </div>

            <BModal v-model="confirmUpdate" title="Confirm updates" okTitle="Update selected" okVariant="primary" @ok="startUpdateQueue">
                Update {{ selectedCount }} services on {{ selectedStackCount }} stacks across {{ selectedAgentCount }} agents?
            </BModal>
        </div>
    </transition>
</template>
```

- [ ] **Step 2: Add script**

Add the script section:

```vue
<script>
import { BModal } from "bootstrap-vue-next";
import {
    buildMaintenanceQueue,
    flattenMaintenanceScan,
    getMaintenanceSummary,
} from "../util-maintenance";

export default {
    components: {
        BModal,
    },
    data() {
        return {
            scanning: false,
            scanResults: [],
            selected: {},
            queue: [],
            queueRunning: false,
            updatesOnly: true,
            agentFilter: "",
            searchText: "",
            confirmUpdate: false,
        };
    },
    computed: {
        rows() {
            return flattenMaintenanceScan(this.scanResults);
        },
        summary() {
            return getMaintenanceSummary(this.rows, this.scanResults);
        },
        summaryItems() {
            return [
                { label: "Agents", value: this.summary.agents },
                { label: "Stacks", value: this.summary.stacks },
                { label: "Services", value: this.summary.services },
                { label: "Updates", value: this.summary.updates },
                { label: "Unknown", value: this.summary.unknown },
                { label: "Failed agents", value: this.summary.failedAgents },
            ];
        },
        agentOptions() {
            return this.scanResults.map((scan) => ({
                endpoint: scan.endpoint,
                name: scan.name,
            }));
        },
        filteredRows() {
            const search = this.searchText.trim().toLowerCase();
            return this.rows.filter((row) => {
                if (this.updatesOnly && row.status !== "update-available") {
                    return false;
                }
                if (this.agentFilter && row.endpoint !== this.agentFilter) {
                    return false;
                }
                if (!search) {
                    return true;
                }
                return `${row.agentName} ${row.stackName} ${row.service} ${row.image}`.toLowerCase().includes(search);
            });
        },
        selectedRows() {
            return this.rows.filter((row) => this.selected[row.key] && row.selectable);
        },
        selectedCount() {
            return this.selectedRows.length;
        },
        selectedStackCount() {
            return new Set(this.selectedRows.map((row) => `${row.endpoint}_${row.stackName}`)).size;
        },
        selectedAgentCount() {
            return new Set(this.selectedRows.map((row) => row.endpoint)).size;
        },
    },
    methods: {
        scanAllAgents() {
            this.scanning = true;
            this.scanResults = [];
            this.selected = {};

            const agents = this.getOnlineAgents();
            let pending = agents.length;

            if (pending === 0) {
                this.scanning = false;
                return;
            }

            for (const agent of agents) {
                this.$root.emitAgent(agent.endpoint, "checkAllStackUpdates", (res) => {
                    if (res.ok) {
                        this.scanResults.push({
                            endpoint: agent.endpoint,
                            name: agent.name,
                            ok: true,
                            checkedAt: res.checkedAt,
                            stacks: res.stacks,
                        });
                    } else {
                        this.scanResults.push({
                            endpoint: agent.endpoint,
                            name: agent.name,
                            ok: false,
                            error: res.msg || "Scan failed",
                            stacks: [],
                        });
                    }

                    pending--;
                    if (pending === 0) {
                        this.scanning = false;
                        this.selectAllUpdateable();
                    }
                });
            }
        },
        getOnlineAgents() {
            const agents = [
                {
                    endpoint: "",
                    name: this.$t("currentEndpoint"),
                },
            ];

            for (const [ endpoint, agent ] of Object.entries(this.$root.agentList)) {
                if (this.$root.agentStatusList[endpoint] === "online") {
                    agents.push({
                        endpoint,
                        name: agent.name || endpoint,
                    });
                }
            }

            return agents;
        },
        selectAllUpdateable() {
            const selected = {};
            for (const row of this.rows) {
                if (row.selectable) {
                    selected[row.key] = true;
                }
            }
            this.selected = selected;
        },
        startUpdateQueue() {
            this.queue = buildMaintenanceQueue(this.rows, this.selected);
            this.runNextJob();
        },
        runNextJob() {
            const nextJob = this.queue.find((job) => job.status === "queued");
            if (!nextJob) {
                this.queueRunning = false;
                this.scanAllAgents();
                return;
            }

            this.queueRunning = true;
            nextJob.status = "running";
            this.$root.emitAgent(nextJob.endpoint, "applyStackServiceUpdates", nextJob.stackName, nextJob.serviceNames, (res) => {
                if (res.ok) {
                    nextJob.status = "done";
                } else {
                    nextJob.status = "failed";
                    nextJob.error = res.msg || "Update failed";
                }
                this.runNextJob();
            });
        },
        statusLabel(status) {
            if (status === "update-available") {
                return "Update";
            }
            if (status === "current") {
                return "Current";
            }
            return "Unknown";
        },
        badgeClass(status) {
            if (status === "update-available") {
                return "bg-danger";
            }
            if (status === "current") {
                return "bg-success";
            }
            return "bg-secondary";
        },
    },
};
</script>
```

- [ ] **Step 3: Add compact styles**

Add a scoped style section:

```vue
<style lang="scss" scoped>
@import "../styles/vars.scss";

.maintenance-header,
.maintenance-toolbar,
.maintenance-batch {
    align-items: center;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    min-width: 0;
}

.maintenance-subtitle,
.maintenance-empty,
.maintenance-reason {
    color: $dark-font-color2;
}

.maintenance-summary {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.maintenance-metric {
    padding: 12px;
}

.maintenance-metric span {
    display: block;
    font-size: 1.25rem;
    font-weight: 700;
}

.maintenance-table-wrap {
    overflow-x: auto;
}

.maintenance-table {
    min-width: 900px;
}

.maintenance-image,
.maintenance-reason {
    overflow-wrap: anywhere;
}

.maintenance-batch {
    bottom: 16px;
    left: 50%;
    padding: 12px 16px;
    position: sticky;
    transform: translateX(-50%);
    width: min(760px, 100%);
    z-index: 10;
}

@media (max-width: 767px) {
    .maintenance-header,
    .maintenance-toolbar,
    .maintenance-batch {
        align-items: stretch;
        flex-direction: column;
    }
}
</style>
```

- [ ] **Step 4: Verify frontend build**

Run:

```bash
pnpm run check-ts
pnpm run build:frontend
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Maintenance.vue
git commit -m "feat: add maintenance center page"
```

## Task 4: Route and Navigation

**Files:**
- Modify: `frontend/src/router.ts`
- Modify: `frontend/src/layouts/Layout.vue`

- [ ] **Step 1: Add route**

In `frontend/src/router.ts`, import:

```ts
const Maintenance = () => import("./pages/Maintenance.vue");
```

Add route under the dashboard children:

```ts
{
    path: "/maintenance",
    component: Maintenance,
},
```

- [ ] **Step 2: Add desktop nav link**

In `frontend/src/layouts/Layout.vue`, add a nav item after Home:

```vue
<li v-if="$root.loggedIn" class="nav-item me-2">
    <router-link to="/maintenance" class="nav-link">
        <font-awesome-icon icon="cloud-arrow-down" /> Maintenance
    </router-link>
</li>
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm run check-ts
pnpm run build:frontend
```

Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/router.ts frontend/src/layouts/Layout.vue
git commit -m "feat: route maintenance center"
```

## Task 5: Final Verification and Live Deploy

**Files:**
- All modified files

- [ ] **Step 1: Run focused tests**

Run:

```bash
env TMPDIR=/private/tmp pnpm exec tsx frontend/src/util-maintenance.test.ts
env TMPDIR=/private/tmp pnpm exec tsx backend/update-planner.test.ts
```

Expected: both PASS.

- [ ] **Step 2: Run repo checks**

Run:

```bash
pnpm run check-ts
pnpm run lint
pnpm run build:frontend
git diff --check
```

Expected:
- `check-ts`: PASS
- `lint`: no errors; existing warnings are acceptable
- `build:frontend`: PASS
- `git diff --check`: no output

- [ ] **Step 3: Push branch**

Run:

```bash
git push origin codex/update-panel
```

- [ ] **Step 4: Deploy live**

Run:

```bash
ssh docker-main 'cd /opt/dockge-custom && git fetch origin codex/update-panel && git checkout codex/update-panel && git pull --ff-only origin codex/update-panel && docker build --target release -t dockge:compose-split-pane -f docker/Dockerfile . && cd /opt/dockge && docker compose up -d'
```

- [ ] **Step 5: Verify live container**

Run:

```bash
ssh docker-main 'docker ps --filter name=dockge-main --format "{{.Names}} {{.Image}} {{.Status}}" && curl -fsS http://127.0.0.1:5001 >/dev/null'
```

Expected: `dockge-main dockge:compose-split-pane Up ... (healthy)` and curl exits 0.
