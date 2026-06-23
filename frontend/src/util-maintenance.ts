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
