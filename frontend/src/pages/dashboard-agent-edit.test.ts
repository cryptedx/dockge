import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DashboardHome.vue", import.meta.url), "utf-8");

assert.doesNotMatch(source, /showEditAgentNameDialog\[agentItem\.name\]/);
assert.match(source, /v-if="endpoint !== ''"/);
assert.match(source, /@click="showEditAgentNameDialog\[endpoint\] = !showEditAgentNameDialog\[endpoint\]"/);
assert.match(source, /<BModal v-model="showEditAgentNameDialog\[endpoint\]"/);
