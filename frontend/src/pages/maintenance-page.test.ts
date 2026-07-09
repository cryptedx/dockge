import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Maintenance.vue", import.meta.url), "utf-8");

assert.match(source, /scanAllAgents\(clearQueue = true\)/);
assert.match(source, /if \(clearQueue\) \{\s+this\.queue = \[\];\s+\}/);
assert.doesNotMatch(source, /this\.scanAllAgents\(false\);/);
assert.match(source, /queueProgressLabel\(\)/);
assert.match(source, /this\.verifyJobUpdate\(nextJob\);/);
assert.match(source, /emitAgent\(job\.endpoint, "checkStackUpdates", job\.stackName/);
assert.match(source, /<th>New Image Age<\/th>/);
assert.match(source, /getMaintenanceImageAge\(row\)/);
assert.match(source, /v-model="dryRun"/);
assert.match(source, /markMaintenanceQueuePreview/);
assert.match(source, /v-model="selectedOnly"/);
assert.match(source, /v-model="hideUnknown"/);
assert.match(source, /v-model="imageAgeFilter"/);
assert.match(source, /getMaintenanceCurrentImage\(row\)/);
assert.match(source, /getMaintenanceTargetImage\(row\)/);
assert.match(source, /getMaintenanceRollbackHint\(row\)/);
assert.match(source, /getMaintenanceHistoryLabel\(history\[row\.key\]\)/);
assert.match(source, /import Terminal from "\.\.\/components\/Terminal\.vue";/);
assert.match(source, /getComposeTerminalName,\s+PROGRESS_TERMINAL_ROWS/s);
assert.match(source, /<Terminal[\s\S]*:name="activeTerminalName"/);
assert.match(source, /queueProgressLabel\(\)[\s\S]*image/);
assert.match(source, /:key="queueJobKey\(job\)"/);
assert.match(source, /queueJobKey\(job\)\s*\{[\s\S]*JSON\.stringify/);
