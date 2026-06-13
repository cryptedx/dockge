import assert from "node:assert/strict";
import test from "node:test";

import {
    DETAILS_PANE_CONFIG,
    STACK_PANE_CONFIG,
    clampPaneWidth,
    readPaneWidth,
    shouldCollapseSecondaryPanes,
    writePaneWidth,
} from "./util-split-pane";

class MemoryStorage implements Storage {
    private values = new Map<string, string>();

    get length() {
        return this.values.size;
    }

    clear() {
        this.values.clear();
    }

    getItem(key: string) {
        return this.values.get(key) ?? null;
    }

    key(index: number) {
        return Array.from(this.values.keys())[index] ?? null;
    }

    removeItem(key: string) {
        this.values.delete(key);
    }

    setItem(key: string, value: string) {
        this.values.set(key, value);
    }
}

test("clampPaneWidth clamps to pane bounds", () => {
    assert.equal(clampPaneWidth(50, STACK_PANE_CONFIG), 180);
    assert.equal(clampPaneWidth(260, STACK_PANE_CONFIG), 260);
    assert.equal(clampPaneWidth(999, STACK_PANE_CONFIG), 420);
    assert.equal(clampPaneWidth(100, DETAILS_PANE_CONFIG), 260);
    assert.equal(clampPaneWidth(999, DETAILS_PANE_CONFIG), 520);
});

test("readPaneWidth returns defaults for missing and invalid values", () => {
    const storage = new MemoryStorage();

    assert.equal(readPaneWidth(storage, STACK_PANE_CONFIG), 260);

    storage.setItem(STACK_PANE_CONFIG.storageKey, "not-a-number");
    assert.equal(readPaneWidth(storage, STACK_PANE_CONFIG), 260);

    storage.setItem(STACK_PANE_CONFIG.storageKey, "900");
    assert.equal(readPaneWidth(storage, STACK_PANE_CONFIG), 420);
});

test("writePaneWidth persists clamped values", () => {
    const storage = new MemoryStorage();

    const nextWidth = writePaneWidth(storage, DETAILS_PANE_CONFIG, 900);

    assert.equal(nextWidth, 520);
    assert.equal(storage.getItem(DETAILS_PANE_CONFIG.storageKey), "520");
});

test("shouldCollapseSecondaryPanes protects the editor width", () => {
    assert.equal(shouldCollapseSecondaryPanes(900, 260, 320), true);
    assert.equal(shouldCollapseSecondaryPanes(1280, 260, 320), false);
});
