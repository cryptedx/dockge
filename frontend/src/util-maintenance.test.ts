import assert from "node:assert/strict";
import {
    buildMaintenanceQueue,
    flattenMaintenanceScan,
    getMaintenanceSummary,
    getSelectableAgentKeys,
    getSelectableStackKeys,
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

assert.deepEqual(getMaintenanceSummary(rows, scans), {
    agents: 3,
    failedAgents: 1,
    stacks: 2,
    services: 4,
    updates: 2,
    unknown: 1,
});

assert.deepEqual(getSelectableStackKeys(rows, "", "media"), [ "_media_plex" ]);
assert.deepEqual(getSelectableAgentKeys(rows, "tcp://agent:5001"), [ "tcp://agent:5001_tools_wiki" ]);

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
