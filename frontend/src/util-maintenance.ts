import { normalizeImageReference } from "../../common/util-common";

export type MaintenanceStatus = "current" | "update-available" | "unknown";
export type MaintenanceJobStatus = "queued" | "running" | "done" | "failed" | "preview";
export type MaintenanceReasonCode = "no-local-digest" | "no-remote-digest" | "registry-auth" | "registry-timeout" | "registry-error" | "compose-config-error";

export interface MaintenanceService {
    service: string;
    image: string;
    status: MaintenanceStatus;
    localDigests?: string[];
    remoteDigest?: string;
    remoteCreatedAt?: string;
    registryUrl?: string;
    rollbackImage?: string;
    reason?: string;
    reasonCode?: MaintenanceReasonCode;
}

export interface MaintenancePreflight {
    status: "ok" | "warning" | "failed";
    checks: Array<{
        name: string;
        status: "ok" | "warning" | "failed";
        message: string;
    }>;
}

export interface MaintenanceScan {
    endpoint: string;
    name: string;
    ok: boolean;
    error?: string;
    stacks: Array<{
        name: string;
        preflight?: MaintenancePreflight;
        services: MaintenanceService[];
    }>;
}

export interface MaintenanceRow extends MaintenanceService {
    key: string;
    endpoint: string;
    agentName: string;
    stackName: string;
    selectable: boolean;
    preflight?: MaintenancePreflight;
}

export interface MaintenanceUpdateJob {
    endpoint: string;
    agentName: string;
    stackName: string;
    serviceName: string;
    serviceNames: string[];
    image: string;
    targetImage: string;
    status: MaintenanceJobStatus;
    error?: string;
}

export interface MaintenanceSnapshot {
    scanResults: MaintenanceScan[];
    selected: Record<string, boolean>;
    history?: Record<string, MaintenanceHistoryEntry>;
    scannedAt?: string;
}

export interface MaintenanceHistoryEntry {
    status: "done" | "failed" | "preview";
    checkedAt: string;
    remoteDigest?: string;
    error?: string;
    rollbackImage?: string;
}

export const MAINTENANCE_SNAPSHOT_KEY = "dockge.maintenance.lastScan";
export const MAINTENANCE_SNAPSHOT_UPDATED_EVENT = "dockge.maintenance.snapshotUpdated";
export const MAINTENANCE_SNAPSHOT_MAX_AGE = 5 * 60 * 1000;

export function maintenanceKey(endpoint: string, stackName: string, serviceName: string) {
    return `${endpoint}_${stackName}_${serviceName}`;
}

function imageWithDigest(image: string, digest: string) {
    return `${image.split("@")[0]}@${digest}`;
}

export function getMaintenanceDisplayImage(service: MaintenanceService) {
    return getMaintenanceTargetImage(service);
}

export function getMaintenanceCurrentImage(service: MaintenanceService) {
    if (service.localDigests?.[0]) {
        return imageWithDigest(service.image, service.localDigests[0]);
    }
    if (service.rollbackImage) {
        return service.rollbackImage;
    }
    return service.image;
}

export function getMaintenanceTargetImage(service: MaintenanceService) {
    if (service.status === "update-available" && service.remoteDigest) {
        return imageWithDigest(service.image, service.remoteDigest);
    }
    return service.image;
}

export function getMaintenanceRegistryLabel(service: MaintenanceService) {
    return service.registryUrl ? "Registry" : "";
}

export function getMaintenanceRollbackHint(service: MaintenanceService) {
    const rollbackImage = service.rollbackImage || (service.localDigests?.[0] ? imageWithDigest(service.image, service.localDigests[0]) : undefined);
    return rollbackImage ? `Rollback image: ${rollbackImage}` : "";
}

export function getMaintenanceReasonCodeLabel(service: MaintenanceService) {
    if (!service.reasonCode) {
        return "";
    }

    const labels: Record<MaintenanceReasonCode, string> = {
        "no-local-digest": "Local",
        "no-remote-digest": "Remote",
        "registry-auth": "Auth",
        "registry-timeout": "Timeout",
        "registry-error": "Registry",
        "compose-config-error": "Compose",
    };
    return labels[service.reasonCode];
}

export function getMaintenanceImageAge(service: MaintenanceService, now = Date.now()) {
    if (service.status !== "update-available" || !service.remoteCreatedAt) {
        return "";
    }

    const createdAt = Date.parse(service.remoteCreatedAt);
    if (!Number.isFinite(createdAt)) {
        return "";
    }

    const minutes = Math.floor(Math.max(0, now - createdAt) / 60_000);
    if (minutes < 60) {
        return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 48) {
        return `${hours}h`;
    }

    return `${Math.floor(hours / 24)}d`;
}

export function isMaintenanceImageOlderThanDays(service: MaintenanceService, days: number, now = Date.now()) {
    if (days <= 0 || !service.remoteCreatedAt) {
        return false;
    }

    const createdAt = Date.parse(service.remoteCreatedAt);
    if (!Number.isFinite(createdAt)) {
        return false;
    }

    return now - createdAt >= days * 24 * 60 * 60 * 1000;
}

export function flattenMaintenanceScan(scans: MaintenanceScan[]): MaintenanceRow[] {
    const entries: Array<{
        scan: MaintenanceScan;
        stack: MaintenanceScan["stacks"][number];
        service: MaintenanceService;
        baseKey: string;
        identityKey: string;
    }> = [];
    const identitiesByBaseKey = new Map<string, Set<string>>();

    for (const scan of scans) {
        for (const stack of scan.stacks) {
            for (const service of stack.services) {
                const baseKey = maintenanceKey(scan.endpoint, stack.name, service.service);
                const identityKey = JSON.stringify([ scan.endpoint, stack.name, service.service ]);
                const identities = identitiesByBaseKey.get(baseKey) ?? new Set<string>();
                identities.add(identityKey);
                identitiesByBaseKey.set(baseKey, identities);
                entries.push({
                    scan,
                    stack,
                    service,
                    baseKey,
                    identityKey,
                });
            }
        }
    }

    const rows = new Map<string, MaintenanceRow>();
    for (const { scan, stack, service, baseKey, identityKey } of entries) {
        const key = identitiesByBaseKey.get(baseKey)?.size === 1 ? baseKey : identityKey;
        const row = {
            ...service,
            key,
            endpoint: scan.endpoint,
            agentName: scan.name,
            stackName: stack.name,
            selectable: service.status === "update-available",
            preflight: stack.preflight,
        };
        if (!rows.has(key) || service.status === "update-available") {
            rows.set(key, row);
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

export function parseMaintenanceSnapshot(value: string | null): MaintenanceSnapshot | undefined {
    if (!value) {
        return undefined;
    }
    try {
        const snapshot = JSON.parse(value) as Partial<MaintenanceSnapshot>;
        if (!Array.isArray(snapshot.scanResults) || typeof snapshot.selected !== "object" || snapshot.selected === null) {
            return undefined;
        }
        return {
            scanResults: snapshot.scanResults,
            selected: snapshot.selected,
            history: typeof snapshot.history === "object" && snapshot.history !== null ? snapshot.history : undefined,
            ...(typeof snapshot.scannedAt === "string" ? { scannedAt: snapshot.scannedAt } : {}),
        };
    } catch {
        return undefined;
    }
}

export function isMaintenanceSnapshotFresh(snapshot: MaintenanceSnapshot | undefined, now = Date.now()) {
    const scannedAt = Date.parse(snapshot?.scannedAt || "");
    const age = now - scannedAt;
    return Number.isFinite(scannedAt) && age >= 0 && age <= MAINTENANCE_SNAPSHOT_MAX_AGE;
}

export function getMaintenanceSnapshotStack(snapshot: MaintenanceSnapshot | undefined, endpoint: string, stackName: string) {
    if (!isMaintenanceSnapshotFresh(snapshot)) {
        return undefined;
    }
    const scan = snapshot?.scanResults.find((item) => item.endpoint === endpoint);
    const stack = scan?.stacks.find((item) => item.name === stackName);
    if (!stack) {
        return undefined;
    }
    return {
        services: stack.services,
    };
}

export function getMaintenanceSnapshotStackUpdateCount(snapshot: MaintenanceSnapshot | undefined, endpoint: string, stackName: string) {
    return getMaintenanceSnapshotStack(snapshot, endpoint, stackName)
        ?.services.filter((service) => service.status === "update-available").length || 0;
}

export function replaceMaintenanceScanStack(
    scans: MaintenanceScan[],
    endpoint: string,
    stackName: string,
    updates: Pick<MaintenanceScan["stacks"][number], "preflight" | "services">
) {
    let replaced = false;
    const nextScans = scans.map((scan) => {
        if (scan.endpoint !== endpoint) {
            return scan;
        }

        let stackReplaced = false;
        const nextStacks = scan.stacks.map((stack) => {
            if (stack.name !== stackName) {
                return stack;
            }
            stackReplaced = true;
            return {
                ...stack,
                ...updates,
            };
        });
        if (!stackReplaced) {
            return scan;
        }

        replaced = true;
        return {
            ...scan,
            stacks: nextStacks,
        };
    });

    return replaced ? nextScans : undefined;
}

export function replaceMaintenanceSnapshotStack(snapshot: MaintenanceSnapshot | undefined, endpoint: string, stackName: string, updates: Pick<MaintenanceScan["stacks"][number], "preflight" | "services">) {
    if (!isMaintenanceSnapshotFresh(snapshot)) {
        return false;
    }
    const scan = snapshot?.scanResults.find((item) => item.endpoint === endpoint);
    const stack = scan?.stacks.find((item) => item.name === stackName);
    if (!stack) {
        return false;
    }

    stack.preflight = updates.preflight;
    stack.services = updates.services;
    return true;
}

export function buildMaintenanceQueue(rows: MaintenanceRow[], selected: Record<string, boolean>): MaintenanceUpdateJob[] {
    const jobs = new Map<string, MaintenanceUpdateJob>();

    for (const row of rows) {
        if (!selected[row.key] || !row.selectable) {
            continue;
        }

        const targetImage = getMaintenanceTargetImage(row);
        const image = normalizeImageReference(row.image);
        const jobKey = JSON.stringify([
            row.endpoint,
            row.stackName,
            image.registry,
            image.repository,
            image.tag,
            row.remoteDigest || "",
        ]);
        const existingJob = jobs.get(jobKey);
        if (existingJob) {
            existingJob.serviceNames.push(row.service);
            existingJob.serviceName = existingJob.serviceNames.join(", ");
            continue;
        }

        jobs.set(jobKey, {
            endpoint: row.endpoint,
            agentName: row.agentName,
            stackName: row.stackName,
            serviceName: row.service,
            serviceNames: [ row.service ],
            image: row.image,
            targetImage,
            status: "queued",
        });
    }

    return [ ...jobs.values() ];
}

export function markMaintenanceQueuePreview(queue: MaintenanceUpdateJob[]): MaintenanceUpdateJob[] {
    return queue.map((job) => ({
        ...job,
        status: "preview",
    }));
}

export function recordMaintenanceHistory(
    history: Record<string, MaintenanceHistoryEntry>,
    rows: MaintenanceRow[],
    job: MaintenanceUpdateJob,
    status: "done" | "failed" | "preview",
    checkedAt = new Date().toISOString(),
    error?: string
) {
    const nextHistory = {
        ...history,
    };
    const serviceNames = new Set(job.serviceNames);
    for (const row of rows) {
        if (row.endpoint !== job.endpoint || row.stackName !== job.stackName || !serviceNames.has(row.service)) {
            continue;
        }
        nextHistory[row.key] = {
            status,
            checkedAt,
            ...(row.remoteDigest ? { remoteDigest: row.remoteDigest } : {}),
            rollbackImage: row.rollbackImage || (row.localDigests?.[0] ? imageWithDigest(row.image, row.localDigests[0]) : undefined),
        };
        if (error) {
            nextHistory[row.key].error = error;
        }
    }
    return nextHistory;
}

export function getMaintenanceHistoryLabel(entry?: MaintenanceHistoryEntry, remoteDigest?: string) {
    if (!entry || !entry.remoteDigest || entry.remoteDigest !== remoteDigest) {
        return "";
    }
    if (entry.status === "done") {
        return "Done";
    }
    if (entry.status === "failed") {
        return "Failed";
    }
    return "Preview";
}
