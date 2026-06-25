<template>
    <transition name="slide-fade" appear>
        <div class="maintenance-page">
            <div class="maintenance-header mb-3">
                <div>
                    <h1 class="mb-1">Maintenance</h1>
                    <div class="maintenance-subtitle">Scan all agents and update selected services sequentially.</div>
                </div>
                <div class="maintenance-actions">
                    <button class="btn btn-primary" type="button" :disabled="scanning || queueRunning" @click="scanAllAgents">
                        <font-awesome-icon icon="search" class="me-1" />
                        {{ scanning ? "Scanning…" : "Scan All Agents" }}
                    </button>
                    <button v-if="scanning" class="btn btn-danger" type="button" @click="stopScan">
                        Stop
                    </button>
                </div>
            </div>

            <div class="maintenance-summary mb-3">
                <div v-for="item in summaryItems" :key="item.label" class="shadow-box maintenance-metric">
                    <span>{{ item.value }}</span>
                    <small>{{ item.label }}</small>
                </div>
            </div>

            <div class="shadow-box big-padding mb-3 maintenance-toolbar">
                <label class="form-check">
                    <input v-model="updatesOnly" class="form-check-input" type="checkbox" name="updates-only" />
                    <span class="form-check-label">Updates Only</span>
                </label>
                <select v-model="agentFilter" class="form-select" name="agent-filter" aria-label="Agent Filter">
                    <option value="">All Agents</option>
                    <option v-for="agent in agentOptions" :key="agent.endpoint" :value="agent.endpoint">{{ agent.name }}</option>
                </select>
                <input v-model="searchText" class="form-control" type="search" name="maintenance-search" autocomplete="off" aria-label="Search stacks, services, and images" placeholder="Search stack, service, image…" />
            </div>

            <div v-if="scanning" class="shadow-box big-padding mb-3 maintenance-progress" role="status" aria-live="polite">
                <div class="maintenance-progress-head">
                    <strong>{{ scanProgressTitle }}</strong>
                    <span>{{ scanPercent }}%</span>
                </div>
                <div class="progress">
                    <div
                        class="progress-bar"
                        role="progressbar"
                        :style="{ width: `${scanPercent}%` }"
                        :aria-valuenow="scanPercent"
                        aria-valuemin="0"
                        aria-valuemax="100"
                    ></div>
                </div>
                <small>{{ scanDone }} / {{ scanTotal }} stacks scanned</small>
            </div>

            <div v-if="failedScans.length > 0" class="alert alert-warning py-2 mb-3" role="alert">
                <div v-for="scan in failedScans" :key="scan.endpoint || 'current'">
                    {{ scan.name }}: {{ scan.error }}
                </div>
            </div>

            <div class="shadow-box maintenance-table-wrap">
                <table class="table maintenance-table mb-0">
                    <colgroup>
                        <col class="maintenance-col-service" />
                        <col class="maintenance-col-agent" />
                        <col class="maintenance-col-stack" />
                        <col class="maintenance-col-container" />
                        <col class="maintenance-col-image" />
                        <col class="maintenance-col-status" />
                        <col class="maintenance-col-reason" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Service</th>
                            <th>Agent</th>
                            <th>Stack</th>
                            <th>Container</th>
                            <th>Image</th>
                            <th>Status</th>
                            <th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="!scanResults.length && !scanning">
                            <td colspan="7" class="maintenance-empty">Run a scan to load update status from all agents.</td>
                        </tr>
                        <tr v-if="scanResults.length > 0 && filteredRows.length === 0 && !scanning">
                            <td colspan="7" class="maintenance-empty">No services match the current filters.</td>
                        </tr>
                        <tr v-for="row in filteredRows" :key="row.key">
                            <td>
                                <label class="maintenance-check">
                                    <input
                                        v-model="selected[row.key]"
                                        class="form-check-input"
                                        type="checkbox"
                                        :disabled="!row.selectable || queueRunning"
                                    />
                                    <span>{{ row.service }}</span>
                                </label>
                            </td>
                            <td>{{ row.agentName }}</td>
                            <td>{{ row.stackName }}</td>
                            <td>{{ row.service }}</td>
                            <td class="maintenance-image">
                                <span :title="row.image">{{ row.image }}</span>
                            </td>
                            <td><span class="badge" :class="badgeClass(row.status)">{{ statusLabel(row.status) }}</span></td>
                            <td class="maintenance-reason">{{ row.reason || "" }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="queue.length > 0" class="shadow-box big-padding mt-3 maintenance-queue">
                <div class="maintenance-queue-header mb-2">
                    <h4 class="mb-0">Update queue</h4>
                    <span class="badge bg-secondary">{{ queueStatus }}</span>
                </div>
                <div v-for="job in queue" :key="`${job.endpoint}_${job.stackName}`" class="maintenance-job">
                    <span class="badge" :class="jobBadgeClass(job.status)">{{ job.status }}</span>
                    <span>{{ job.agentName }} / {{ job.stackName }}</span>
                    <span class="maintenance-job-services">{{ job.serviceNames.join(", ") }}</span>
                    <span v-if="job.error" class="maintenance-reason">{{ job.error }}</span>
                </div>
            </div>

            <div v-if="selectedCount > 0" class="maintenance-batch shadow-box">
                <div>
                    <strong>{{ selectedCount }}</strong> services selected across
                    <strong>{{ selectedStackCount }}</strong> stacks and
                    <strong>{{ selectedAgentCount }}</strong> agents
                </div>
                <button class="btn btn-primary" type="button" :disabled="queueRunning" @click="confirmUpdate = true">
                    <font-awesome-icon icon="cloud-arrow-down" class="me-1" />
                    Update Selected
                </button>
            </div>

            <BModal v-model="confirmUpdate" title="Confirm Updates" okTitle="Update Selected" okVariant="primary" @ok="startUpdateQueue">
                Update {{ selectedCount }} services on {{ selectedStackCount }} stacks across {{ selectedAgentCount }} agents?
            </BModal>
        </div>
    </transition>
</template>

<script>
import { BModal } from "bootstrap-vue-next";
import {
    buildMaintenanceQueue,
    flattenMaintenanceScan,
    getMaintenanceProgressPercent,
    getMaintenanceSummary,
    isCurrentMaintenanceScan,
    MAINTENANCE_SNAPSHOT_KEY,
    MAINTENANCE_SNAPSHOT_UPDATED_EVENT,
    parseMaintenanceSnapshot,
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
            scanDone: 0,
            updatesOnly: true,
            agentFilter: "",
            searchText: "",
            scanCurrentAgent: "",
            scanCurrentStack: "",
            scanRunId: 0,
            scanTotal: 0,
            confirmUpdate: false,
        };
    },
    computed: {
        rows() {
            return flattenMaintenanceScan(this.scanResults);
        },
        failedScans() {
            return this.scanResults.filter((scan) => !scan.ok);
        },
        summary() {
            return getMaintenanceSummary(this.rows, this.scanResults);
        },
        summaryItems() {
            return [
                {
                    label: "Agents",
                    value: this.summary.agents,
                },
                {
                    label: "Stacks",
                    value: this.summary.stacks,
                },
                {
                    label: "Services",
                    value: this.summary.services,
                },
                {
                    label: "Updates",
                    value: this.summary.updates,
                },
                {
                    label: "Unknown",
                    value: this.summary.unknown,
                },
                {
                    label: "Failed agents",
                    value: this.summary.failedAgents,
                },
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
        queueStatus() {
            if (this.queueRunning) {
                return "running";
            }
            if (this.queue.some((job) => job.status === "failed")) {
                return "finished with errors";
            }
            return "finished";
        },
        scanPercent() {
            return getMaintenanceProgressPercent(this.scanDone, this.scanTotal);
        },
        scanProgressTitle() {
            if (!this.scanCurrentStack) {
                return "Preparing scan";
            }
            return `Scanning ${this.scanCurrentAgent} / ${this.scanCurrentStack}`;
        },
    },
    mounted() {
        this.restoreSnapshot();
    },
    methods: {
        scanAllAgents() {
            this.scanning = true;
            this.scanResults = [];
            this.selected = {};
            this.queue = [];
            this.scanDone = 0;
            this.scanCurrentAgent = "";
            this.scanCurrentStack = "";
            const scanRunId = this.scanRunId + 1;
            this.scanRunId = scanRunId;

            const agents = this.getAgentTargets();
            const tasks = [];

            for (const agent of agents) {
                if (agent.status !== "online") {
                    this.scanResults.push({
                        endpoint: agent.endpoint,
                        name: agent.name,
                        ok: false,
                        error: `Agent is ${agent.status}`,
                        stacks: [],
                    });
                    continue;
                }

                this.scanResults.push({
                    endpoint: agent.endpoint,
                    name: agent.name,
                    ok: true,
                    stacks: [],
                });
                for (const stackName of agent.stacks) {
                    tasks.push({
                        ...agent,
                        stackName,
                    });
                }
            }

            this.scanTotal = tasks.length;
            if (tasks.length === 0) {
                this.finishScan(scanRunId);
                return;
            }
            this.runNextScanTask(tasks, 0, scanRunId);
        },
        runNextScanTask(tasks, index, scanRunId) {
            if (!isCurrentMaintenanceScan(this.scanRunId, scanRunId)) {
                return;
            }
            const task = tasks[index];
            this.scanCurrentAgent = task.name;
            this.scanCurrentStack = task.stackName;

            this.$root.emitAgent(task.endpoint, "checkStackUpdates", task.stackName, (res) => {
                if (!isCurrentMaintenanceScan(this.scanRunId, scanRunId)) {
                    return;
                }
                const scan = this.scanResults.find((item) => item.endpoint === task.endpoint);
                if (scan) {
                    if (res.ok) {
                        scan.stacks.push({
                            name: task.stackName,
                            services: res.updates.services,
                        });
                    } else {
                        scan.ok = false;
                        scan.error = res.msg || `${task.stackName}: Scan failed`;
                    }
                    this.scanResults = [ ...this.scanResults ];
                    this.saveSnapshot();
                }

                this.scanDone = index + 1;
                if (this.scanDone === tasks.length) {
                    this.finishScan(scanRunId);
                    return;
                }
                this.runNextScanTask(tasks, index + 1, scanRunId);
            });
        },
        stopScan() {
            this.scanRunId++;
            this.scanning = false;
            this.scanCurrentAgent = "";
            this.scanCurrentStack = "";
            this.selectAllUpdateable();
        },
        finishScan(scanRunId) {
            if (!isCurrentMaintenanceScan(this.scanRunId, scanRunId)) {
                return;
            }
            this.scanning = false;
            this.scanCurrentAgent = "";
            this.scanCurrentStack = "";
            this.selectAllUpdateable();
        },
        getAgentTargets() {
            const agents = [
                {
                    endpoint: "",
                    name: this.$t("currentEndpoint"),
                    status: this.$root.agentStatusList[""] || "online",
                    stacks: this.getAgentStackNames(""),
                },
            ];

            for (const [ endpoint, agent ] of Object.entries(this.$root.agentList)) {
                agents.push({
                    endpoint,
                    name: agent.name || endpoint,
                    status: this.$root.agentStatusList[endpoint] || "offline",
                    stacks: this.getAgentStackNames(endpoint),
                });
            }

            return agents;
        },
        getAgentStackNames(endpoint) {
            const stackList = endpoint
                ? this.$root.allAgentStackList[endpoint]?.stackList
                : this.$root.stackList;
            return Object.entries(stackList || {})
                .filter((entry) => entry[1]?.isManagedByDockge !== false)
                .map((entry) => entry[0]);
        },
        selectAllUpdateable() {
            const selected = {};
            for (const row of this.rows) {
                if (row.selectable) {
                    selected[row.key] = true;
                }
            }
            this.selected = selected;
            this.saveSnapshot();
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
        jobBadgeClass(status) {
            if (status === "done") {
                return "bg-success";
            }
            if (status === "failed") {
                return "bg-danger";
            }
            if (status === "running") {
                return "bg-primary";
            }
            return "bg-secondary";
        },
        restoreSnapshot() {
            const snapshot = parseMaintenanceSnapshot(localStorage.getItem(MAINTENANCE_SNAPSHOT_KEY));
            if (!snapshot) {
                return;
            }
            this.scanResults = snapshot.scanResults;
            this.selected = snapshot.selected;
        },
        saveSnapshot() {
            if (!this.scanResults.length) {
                return;
            }
            localStorage.setItem(MAINTENANCE_SNAPSHOT_KEY, JSON.stringify({
                scanResults: this.scanResults,
                selected: this.selected,
            }));
            window.dispatchEvent(new Event(MAINTENANCE_SNAPSHOT_UPDATED_EVENT));
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../styles/vars.scss";

.maintenance-header,
.maintenance-actions,
.maintenance-toolbar,
.maintenance-batch,
.maintenance-queue-header {
    align-items: center;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    min-width: 0;
}

.maintenance-subtitle,
.maintenance-empty,
.maintenance-reason,
.maintenance-job-services {
    color: $dark-font-color3;
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
    min-width: 1120px;
    table-layout: fixed;
    --bs-table-bg: transparent;
    --bs-table-color: inherit;
    --bs-table-border-color: rgba(255, 255, 255, 0.08);

    .dark & {
        --bs-table-bg: #0d1117;
        --bs-table-color: #b1b8c0;
        --bs-table-border-color: #1d2634;
        --bs-table-hover-bg: #161b22;
        background-color: #0d1117;
    }
}

.maintenance-col-service {
    width: 10%;
}

.maintenance-col-agent {
    width: 17%;
}

.maintenance-col-stack {
    width: 14%;
}

.maintenance-col-container {
    width: 12%;
}

.maintenance-col-image {
    width: auto;
}

.maintenance-col-status {
    width: 82px;
}

.maintenance-col-reason {
    width: 120px;
}

.maintenance-progress-head {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
}

.maintenance-progress small {
    color: $dark-font-color3;
    display: block;
    margin-top: 8px;
}

.maintenance-check {
    align-items: center;
    display: flex;
    gap: 8px;
    min-width: 0;
}

.maintenance-check span,
.maintenance-reason,
.maintenance-job-services {
    overflow-wrap: anywhere;
}

.maintenance-image span {
    display: block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.maintenance-job {
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: grid;
    gap: 10px;
    grid-template-columns: 90px minmax(180px, 1fr) minmax(220px, 2fr) minmax(180px, 1fr);
    padding: 10px 0;
}

.maintenance-job:first-of-type {
    border-top: 0;
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

    .maintenance-job {
        grid-template-columns: 1fr;
    }
}
</style>
