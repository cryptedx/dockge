import assert from "node:assert/strict";
import { AgentManager } from "./agent-manager";
import { DockgeSocket } from "./util-server";

type Ack = (...args: unknown[]) => void;

interface FakeAgentClient {
    connected: boolean;
    timeout(ms: number): { emit(event: string, ...args: unknown[]): void };
    emit(event: string, ...args: unknown[]): void;
}

function managerWithClient(client: FakeAgentClient) {
    const manager = new AgentManager({} as DockgeSocket);
    const access = manager as unknown as {
        agentSocketList: Record<string, FakeAgentClient>;
        agentLoggedInList: Record<string, boolean>;
    };
    access.agentSocketList["agent.local"] = client;
    access.agentLoggedInList["agent.local"] = true;
    return manager;
}

let forwardedResponse: unknown;
await managerWithClient({
    connected: true,
    timeout(ms) {
        assert.equal(ms, 60_000);
        return this;
    },
    emit(event, endpoint, eventName, stackName, callback) {
        assert.equal(event, "agent");
        assert.equal(endpoint, "agent.local");
        assert.equal(eventName, "checkStackUpdates");
        assert.equal(stackName, "frigate");
        (callback as Ack)(null, { ok: true });
    },
}).emitToEndpoint("agent.local", "checkStackUpdates", "frigate", (res: unknown) => {
    forwardedResponse = res;
});
assert.deepEqual(forwardedResponse, { ok: true });

let timeoutResponse: unknown;
await managerWithClient({
    connected: true,
    timeout(ms) {
        assert.equal(ms, 60_000);
        return this;
    },
    emit(event, endpoint, eventName, stackName, callback) {
        assert.equal(event, "agent");
        assert.equal(endpoint, "agent.local");
        assert.equal(eventName, "checkStackUpdates");
        assert.equal(stackName, "frigate");
        (callback as Ack)(new Error("timeout"));
    },
}).emitToEndpoint("agent.local", "checkStackUpdates", "frigate", (res: unknown) => {
    timeoutResponse = res;
});
assert.deepEqual(timeoutResponse, {
    ok: false,
    msg: "agent.local: checkStackUpdates timed out after 60s",
});
