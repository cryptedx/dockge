import assert from "node:assert/strict";
import {
    buildMaintenanceQueue,
    flattenMaintenanceScan,
    getMaintenanceSummary,
    getMaintenanceProgressPercent,
    getMaintenanceSnapshotStack,
    isCurrentMaintenanceScan,
    parseMaintenanceSnapshot,
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
assert.equal(rows.length, 4);
assert.equal(rows[0].key, "_media_plex");
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
})), {
    scanResults: scans,
    selected: {
        "_media_plex": true,
    },
});
assert.deepEqual(getMaintenanceSnapshotStack({
    scanResults: scans,
    selected: {},
}, "tcp://agent:5001", "tools"), {
    services: scans[1].stacks[0].services,
});
assert.equal(getMaintenanceSnapshotStack(undefined, "", "media"), undefined);
assert.equal(getMaintenanceSnapshotStack({
    scanResults: scans,
    selected: {},
}, "", "missing"), undefined);

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
