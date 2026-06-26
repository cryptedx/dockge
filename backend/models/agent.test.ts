import assert from "node:assert/strict";

import { Agent } from "./agent";

const unnamedAgent = Object.create(Agent.prototype) as Agent;
unnamedAgent.url = "http://agent.local:5001";
unnamedAgent.username = "dockge";

assert.deepEqual(unnamedAgent.toJSON(), {
    url: "http://agent.local:5001",
    username: "dockge",
    endpoint: "agent.local:5001",
    name: "",
    updatedName: "",
});
