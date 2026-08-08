import assert from "node:assert/strict";
import {
    buildMaintenanceQueue,
    flattenMaintenanceScan,
    getMaintenanceCurrentImage,
    getMaintenanceDisplayImage,
    getMaintenanceHistoryLabel,
    getMaintenanceImageAge,
    getMaintenanceReasonCodeLabel,
    getMaintenanceRegistryLabel,
    getMaintenanceRollbackHint,
    getMaintenanceSummary,
    getMaintenanceProgressPercent,
    getMaintenanceSnapshotStack,
    getMaintenanceSnapshotStackUpdateCount,
    getMaintenanceTargetImage,
    isMaintenanceSnapshotFresh,
    isMaintenanceImageOlderThanDays,
    isCurrentMaintenanceScan,
    markMaintenanceQueuePreview,
    MAINTENANCE_SNAPSHOT_MAX_AGE,
    parseMaintenanceSnapshot,
    recordMaintenanceHistory,
    replaceMaintenanceScanStack,
    replaceMaintenanceSnapshotStack,
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
                    {
                        service: "plex",
                        image: "plex:latest",
                        status: "update-available",
                        localDigests: [ "sha256:old" ],
                        remoteDigest: "sha256:new",
                        remoteCreatedAt: "2026-06-24T12:00:00Z",
                        registryUrl: "https://hub.docker.com/r/library/plex/tags",
                        rollbackImage: "plex:latest@sha256:old",
                    },
                    {
                        service: "db",
                        image: "postgres:16",
                        status: "current",
                    },
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
                    {
                        service: "wiki",
                        image: "wiki:latest",
                        status: "update-available",
                    },
                    {
                        service: "cache",
                        image: "redis:7",
                        status: "unknown",
                        reason: "No local repo digest found",
                        reasonCode: "no-local-digest",
                    },
                ],
            },
        ],
    },
    {
        endpoint: "tcp://offline:5001",
        name: "Offline",
        ok: false,
        error: "Agent is offline",
        stacks: [],
    },
];

const rows = flattenMaintenanceScan(scans);
const freshSnapshot = {
    scanResults: scans,
    selected: {},
    scannedAt: new Date().toISOString(),
};
assert.equal(rows.length, 4);
assert.equal(rows[0].key, "_media_plex");
assert.equal(getMaintenanceDisplayImage(rows[0]), "plex:latest@sha256:new");
assert.equal(getMaintenanceCurrentImage(rows[0]), "plex:latest@sha256:old");
assert.equal(getMaintenanceTargetImage(rows[0]), "plex:latest@sha256:new");
assert.equal(getMaintenanceRegistryLabel(rows[0]), "Registry");
assert.equal(getMaintenanceReasonCodeLabel(rows[3]), "Local");
assert.equal(getMaintenanceRollbackHint(rows[0]), "Rollback image: plex:latest@sha256:old");
assert.equal(getMaintenanceImageAge(rows[0], Date.parse("2026-06-25T12:00:00Z")), "24h");
assert.equal(getMaintenanceImageAge(rows[1], Date.parse("2026-06-25T12:00:00Z")), "");
assert.equal(isMaintenanceImageOlderThanDays(rows[0], 1, Date.parse("2026-06-26T12:00:00Z")), true);
assert.equal(isMaintenanceImageOlderThanDays(rows[0], 7, Date.parse("2026-06-26T12:00:00Z")), false);
assert.equal(isMaintenanceImageOlderThanDays(rows[1], 1, Date.parse("2026-06-26T12:00:00Z")), false);
assert.equal(rows[2].key, "tcp://agent:5001_tools_wiki");
assert.equal(rows[3].selectable, false);

const duplicateRows = flattenMaintenanceScan([
    {
        endpoint: "",
        name: "Current",
        ok: true,
        stacks: [
            {
                name: "immich",
                services: [
                    {
                        service: "redis",
                        image: "valkey:9",
                        status: "current",
                    },
                    {
                        service: "redis",
                        image: "valkey:9",
                        status: "update-available",
                    },
                ],
            },
        ],
    },
]);
assert.equal(duplicateRows.length, 1);
assert.equal(duplicateRows[0].status, "update-available");
assert.equal(duplicateRows[0].selectable, true);
assert.equal(getMaintenanceProgressPercent(0, 0), 0);
assert.equal(getMaintenanceProgressPercent(1, 4), 25);
assert.equal(getMaintenanceProgressPercent(5, 4), 100);
assert.equal(isCurrentMaintenanceScan(2, 2), true);
assert.equal(isCurrentMaintenanceScan(3, 2), false);
assert.equal(parseMaintenanceSnapshot(null), undefined);
assert.equal(parseMaintenanceSnapshot("{nope"), undefined);
assert.deepEqual(parseMaintenanceSnapshot(JSON.stringify({
    scanResults: scans,
    selected: {
        "_media_plex": true,
    },
    scannedAt: "2026-07-09T12:00:00Z",
    history: {
        "_media_plex": {
            status: "done",
            checkedAt: "2026-06-25T12:00:00Z",
        },
    },
})), {
    scanResults: scans,
    selected: {
        "_media_plex": true,
    },
    scannedAt: "2026-07-09T12:00:00Z",
    history: {
        "_media_plex": {
            status: "done",
            checkedAt: "2026-06-25T12:00:00Z",
        },
    },
});
assert.deepEqual(getMaintenanceSnapshotStack(freshSnapshot, "tcp://agent:5001", "tools"), {
    services: scans[1].stacks[0].services,
});
assert.equal(getMaintenanceSnapshotStackUpdateCount(freshSnapshot, "", "media"), 1);
assert.equal(getMaintenanceSnapshotStackUpdateCount(freshSnapshot, "tcp://agent:5001", "tools"), 1);
const refreshedScans = replaceMaintenanceScanStack(scans, "", "media", {
    services: [
        {
            service: "plex",
            image: "plex:latest@sha256:new",
            status: "current",
            localDigests: [ "sha256:new" ],
            remoteDigest: "sha256:new",
        },
        {
            service: "db",
            image: "postgres:16",
            status: "current",
        },
    ],
});
assert.ok(refreshedScans);
assert.notEqual(refreshedScans, scans);
assert.equal(flattenMaintenanceScan(refreshedScans).find((row) => row.service === "plex")?.status, "current");
assert.equal(flattenMaintenanceScan(refreshedScans).filter((row) => row.status === "update-available").length, 1);
assert.equal(replaceMaintenanceScanStack(scans, "", "missing", { services: [] }), undefined);
const refreshedSnapshot = structuredClone({
    scanResults: scans,
    selected: {},
    scannedAt: new Date().toISOString(),
});
assert.equal(replaceMaintenanceSnapshotStack(refreshedSnapshot, "", "media", {
    services: [
        {
            service: "plex",
            image: "plex:latest",
            status: "current",
        },
        {
            service: "db",
            image: "postgres:16",
            status: "current",
        },
    ],
}), true);
assert.equal(getMaintenanceSnapshotStackUpdateCount(refreshedSnapshot, "", "media"), 0);
assert.equal(replaceMaintenanceSnapshotStack(refreshedSnapshot, "", "missing", { services: [] }), false);
assert.equal(isMaintenanceSnapshotFresh({
    ...freshSnapshot,
    scannedAt: "2026-07-09T12:00:00Z",
}, Date.parse("2026-07-09T12:05:00Z")), true);
assert.equal(isMaintenanceSnapshotFresh({
    ...freshSnapshot,
    scannedAt: "2026-07-09T12:00:00Z",
}, Date.parse("2026-07-09T12:05:00Z") + 1), false);
assert.equal(getMaintenanceSnapshotStackUpdateCount({
    ...freshSnapshot,
    scannedAt: new Date(Date.now() - MAINTENANCE_SNAPSHOT_MAX_AGE - 1).toISOString(),
}, "", "media"), 0);
assert.equal(MAINTENANCE_SNAPSHOT_MAX_AGE, 5 * 60 * 1000);
assert.equal(getMaintenanceSnapshotStack(undefined, "", "media"), undefined);
assert.equal(getMaintenanceSnapshotStack(freshSnapshot, "", "missing"), undefined);
assert.equal(getMaintenanceSnapshotStackUpdateCount(undefined, "", "media"), 0);
assert.equal(getMaintenanceSnapshotStackUpdateCount(freshSnapshot, "", "missing"), 0);

assert.deepEqual(getMaintenanceSummary(rows, scans), {
    agents: 3,
    failedAgents: 1,
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
        serviceName: "plex",
        serviceNames: [ "plex" ],
        image: "plex:latest",
        targetImage: "plex:latest@sha256:new",
        status: "queued",
    },
    {
        endpoint: "tcp://agent:5001",
        agentName: "Agent",
        stackName: "tools",
        serviceName: "wiki",
        serviceNames: [ "wiki" ],
        image: "wiki:latest",
        targetImage: "wiki:latest",
        status: "queued",
    },
]);

const sameStackRows = flattenMaintenanceScan([
    {
        endpoint: "",
        name: "Current",
        ok: true,
        stacks: [
            {
                name: "media",
                services: [
                    {
                        service: "plex",
                        image: "plex:latest",
                        status: "update-available",
                        remoteDigest: "sha256:plexnew",
                    },
                    {
                        service: "tautulli",
                        image: "tautulli:latest",
                        status: "update-available",
                        remoteDigest: "sha256:tautullinew",
                    },
                ],
            },
        ],
    },
]);

assert.deepEqual(buildMaintenanceQueue(sameStackRows, {
    "_media_plex": true,
    "_media_tautulli": true,
}), [
    {
        endpoint: "",
        agentName: "Current",
        stackName: "media",
        serviceName: "plex",
        serviceNames: [ "plex" ],
        image: "plex:latest",
        targetImage: "plex:latest@sha256:plexnew",
        status: "queued",
    },
    {
        endpoint: "",
        agentName: "Current",
        stackName: "media",
        serviceName: "tautulli",
        serviceNames: [ "tautulli" ],
        image: "tautulli:latest",
        targetImage: "tautulli:latest@sha256:tautullinew",
        status: "queued",
    },
]);

assert.deepEqual(markMaintenanceQueuePreview(buildMaintenanceQueue(rows, {
    "_media_plex": true,
})), [
    {
        endpoint: "",
        agentName: "Current",
        stackName: "media",
        serviceName: "plex",
        serviceNames: [ "plex" ],
        image: "plex:latest",
        targetImage: "plex:latest@sha256:new",
        status: "preview",
    },
]);

const history = recordMaintenanceHistory({}, rows, {
    endpoint: "",
    agentName: "Current",
    stackName: "media",
    serviceName: "plex",
    serviceNames: [ "plex" ],
    image: "plex:latest",
    targetImage: "plex:latest@sha256:new",
    status: "done",
}, "done", "2026-06-25T12:00:00Z");
assert.deepEqual(history["_media_plex"], {
    status: "done",
    checkedAt: "2026-06-25T12:00:00Z",
    remoteDigest: "sha256:new",
    rollbackImage: "plex:latest@sha256:old",
});
assert.equal(getMaintenanceHistoryLabel(history["_media_plex"], "sha256:new"), "Done");
assert.equal(getMaintenanceHistoryLabel(history["_media_plex"], "sha256:other"), "");
assert.equal(getMaintenanceHistoryLabel({
    status: "done",
    checkedAt: "2026-06-25T12:00:00Z",
}, "sha256:new"), "");

const sharedImageRows = flattenMaintenanceScan([
    {
        endpoint: "",
        name: "Current",
        ok: true,
        stacks: [
            {
                name: "shared",
                services: [
                    {
                        service: "web",
                        image: "nginx",
                        status: "update-available",
                        remoteDigest: "sha256:new",
                    },
                    {
                        service: "proxy",
                        image: "docker.io/library/nginx:latest",
                        status: "update-available",
                        remoteDigest: "sha256:new",
                    },
                ],
            },
        ],
    },
]);
const sharedImageQueue = buildMaintenanceQueue(sharedImageRows, {
    [sharedImageRows[0].key]: true,
    [sharedImageRows[1].key]: true,
});
assert.equal(sharedImageQueue.length, 1);
assert.deepEqual(sharedImageQueue[0].serviceNames, [ "web", "proxy" ]);
assert.equal(sharedImageQueue[0].serviceName, "web, proxy");

const collisionRows = flattenMaintenanceScan([
    {
        endpoint: "",
        name: "Current",
        ok: true,
        stacks: [
            {
                name: "a_b",
                services: [
                    {
                        service: "c",
                        image: "nginx:latest",
                        status: "update-available",
                    },
                ],
            },
            {
                name: "a",
                services: [
                    {
                        service: "b_c",
                        image: "redis:latest",
                        status: "update-available",
                    },
                ],
            },
        ],
    },
]);
assert.equal(collisionRows.length, 2);
assert.equal(collisionRows[0].key, "[\"\",\"a_b\",\"c\"]");
assert.equal(collisionRows[1].key, "[\"\",\"a\",\"b_c\"]");

const reversedCollisionRows = flattenMaintenanceScan([
    {
        endpoint: "",
        name: "Current",
        ok: true,
        stacks: [ ...collisionRows ]
            .reverse()
            .map((row) => ({
                name: row.stackName,
                services: [
                    {
                        service: row.service,
                        image: row.image,
                        status: row.status,
                    },
                ],
            })),
    },
]);
const collisionKeys = (items: typeof collisionRows) => Object.fromEntries(items.map((row) => [ `${row.stackName}/${row.service}`, row.key ]));
assert.deepEqual(collisionKeys(reversedCollisionRows), collisionKeys(collisionRows));

const completedService = {
    ...rows[0],
    status: "current" as const,
    localDigests: [ "sha256:new" ],
};
assert.equal(getMaintenanceCurrentImage(completedService), "plex:latest@sha256:new");
