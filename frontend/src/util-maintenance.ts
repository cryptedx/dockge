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
    const rows = new Map<string, MaintenanceRow>();
    for (const scan of scans) {
        for (const stack of scan.stacks) {
            for (const service of stack.services) {
                const key = maintenanceKey(scan.endpoint, stack.name, service.service);
                const row = {
                    ...service,
                    key,
                    endpoint: scan.endpoint,
                    agentName: scan.name,
                    stackName: stack.name,
                    selectable: service.status === "update-available",
                };
                if (!rows.has(key) || service.status === "update-available") {
                    rows.set(key, row);
                }
            }
        }
    }
    return [ ...rows.values() ];
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

export function getMaintenanceProgressPercent(done: number, total: number) {
    if (total <= 0) {
        return 0;
    }
    return Math.min(100, Math.round((done / total) * 100));
}

export function isCurrentMaintenanceScan(activeRunId: number, callbackRunId: number) {
    return activeRunId === callbackRunId;
}

export function getSelectableStackKeys(rows: MaintenanceRow[], endpoint: string, stackName: string) {
    return rows
        .filter((row) => row.endpoint === endpoint && row.stackName === stackName && row.selectable)
        .map((row) => row.key);
}

export function getSelectableAgentKeys(rows: MaintenanceRow[], endpoint: string) {
    return rows
        .filter((row) => row.endpoint === endpoint && row.selectable)
        .map((row) => row.key);
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
