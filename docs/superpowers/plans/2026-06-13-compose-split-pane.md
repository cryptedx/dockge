# Compose Split Pane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cramped nested compose layout with a desktop split-pane workbench that keeps the stack list, YAML editor, and details context available while making the editor resizable and focusable.

**Architecture:** Keep this frontend-only. Put reusable pane sizing, clamping, and persistence logic in a small TypeScript utility, let `Dashboard.vue` own the left stack pane and compose focus event, and let `Compose.vue` own the right details pane and editor focus mode. Use scoped Vue styles for layout so global Dockge styles stay stable.

**Tech Stack:** Vue 3 Options API, Vite, Bootstrap classes where they still fit, CodeMirror 6, localStorage, Node built-in test runner with `tsx` for pure utility tests.

---

## Files and Responsibilities

- Create `frontend/src/util-split-pane.ts`: pure helper functions and constants for pane defaults, min/max widths, localStorage read/write, and narrow-layout detection.
- Create `frontend/src/util-split-pane.test.ts`: Node built-in tests for clamping, invalid storage values, persistence, and narrow viewport detection.
- Modify `frontend/src/pages/Dashboard.vue`: replace Bootstrap grid columns with a flex split shell, make the stack pane resizable, persist its width, and hide it while Compose is in focus mode.
- Modify `frontend/src/pages/Compose.vue`: replace the internal `row`/`col-lg-6` layout with editor and details panes, make the details pane resizable, add focus mode, and emit focus state to `Dashboard.vue`.
- Modify scoped styles in `Dashboard.vue` and `Compose.vue`: pane layout, draggable separators, focus mode, mobile fallback, and CodeMirror sizing.
- Modify `frontend/src/icon.ts`: register the focus mode icons used by the new editor button.

## Verification Commands

- `node --import tsx --test frontend/src/util-split-pane.test.ts`
- `npm run lint`
- `npm run build:frontend`
- `npm run dev:frontend`
- Browser verification at `http://localhost:5000`

---

### Task 1: Add Tested Split Pane Utilities

**Files:**
- Create: `frontend/src/util-split-pane.ts`
- Create: `frontend/src/util-split-pane.test.ts`

- [ ] **Step 1: Write the failing utility test**

Create `frontend/src/util-split-pane.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --import tsx --test frontend/src/util-split-pane.test.ts
```

Expected: FAIL because `frontend/src/util-split-pane.ts` does not exist yet or does not export the named helpers.

- [ ] **Step 3: Add the utility implementation**

Create `frontend/src/util-split-pane.ts`:

```ts
export interface PaneConfig {
    name: "stack" | "details";
    storageKey: string;
    defaultWidth: number;
    minWidth: number;
    maxWidth: number;
}

export const STACK_PANE_CONFIG: PaneConfig = {
    name: "stack",
    storageKey: "dockge.composeSplit.stackWidth",
    defaultWidth: 260,
    minWidth: 180,
    maxWidth: 420,
};

export const DETAILS_PANE_CONFIG: PaneConfig = {
    name: "details",
    storageKey: "dockge.composeSplit.detailsWidth",
    defaultWidth: 320,
    minWidth: 260,
    maxWidth: 520,
};

export const EDITOR_MIN_WIDTH = 480;
export const SPLIT_LAYOUT_CHROME_WIDTH = 48;

export function clampPaneWidth(width: number, config: PaneConfig) {
    if (!Number.isFinite(width)) {
        return config.defaultWidth;
    }

    return Math.min(Math.max(Math.round(width), config.minWidth), config.maxWidth);
}

export function readPaneWidth(storage: Pick<Storage, "getItem"> | null | undefined, config: PaneConfig) {
    if (!storage) {
        return config.defaultWidth;
    }

    const storedValue = storage.getItem(config.storageKey);
    const parsedWidth = storedValue === null ? config.defaultWidth : Number(storedValue);

    return clampPaneWidth(parsedWidth, config);
}

export function writePaneWidth(storage: Pick<Storage, "setItem"> | null | undefined, config: PaneConfig, width: number) {
    const nextWidth = clampPaneWidth(width, config);

    try {
        storage?.setItem(config.storageKey, String(nextWidth));
    } catch {
    }

    return nextWidth;
}

export function shouldCollapseSecondaryPanes(
    viewportWidth: number,
    stackWidth: number,
    detailsWidth: number,
    editorMinWidth = EDITOR_MIN_WIDTH,
    chromeWidth = SPLIT_LAYOUT_CHROME_WIDTH,
) {
    return viewportWidth < stackWidth + detailsWidth + editorMinWidth + chromeWidth;
}
```

- [ ] **Step 4: Run the utility test to verify it passes**

Run:

```bash
node --import tsx --test frontend/src/util-split-pane.test.ts
```

Expected: PASS for all four tests.

- [ ] **Step 5: Run lint for the new TypeScript files**

Run:

```bash
npm run lint -- frontend/src/util-split-pane.ts frontend/src/util-split-pane.test.ts
```

Expected: PASS with no errors.

- [ ] **Step 6: Commit Task 1**

```bash
git add frontend/src/util-split-pane.ts frontend/src/util-split-pane.test.ts
git commit -m "feat: add split pane sizing utilities"
```

---

### Task 2: Convert Dashboard to a Resizable Split Shell

**Files:**
- Modify: `frontend/src/pages/Dashboard.vue`
- Test: `frontend/src/util-split-pane.test.ts`

- [ ] **Step 1: Confirm the current Dashboard has no split shell**

Run:

```bash
rg -n "dashboard-shell|stack-resizer|compose-focus-change" frontend/src/pages/Dashboard.vue
```

Expected: no matches.

- [ ] **Step 2: Replace the Dashboard template**

Replace the full `<template>` block in `frontend/src/pages/Dashboard.vue` with:

```vue
<template>
    <div class="container-fluid dashboard-container">
        <div class="dashboard-shell" :class="{ 'compose-focus-mode': composeFocusMode }">
            <aside
                v-if="!$root.isMobile && !composeFocusMode && !shouldCollapseStackPane"
                class="stack-pane"
                :style="{ width: `${stackPaneWidth}px` }"
            >
                <div>
                    <router-link to="/compose" class="btn btn-primary mb-3"><font-awesome-icon icon="plus" /> {{ $t("compose") }}</router-link>
                </div>
                <StackList :scrollbar="true" />
            </aside>

            <button
                v-if="!$root.isMobile && !composeFocusMode && !shouldCollapseStackPane"
                class="pane-resizer stack-resizer"
                type="button"
                role="separator"
                aria-orientation="vertical"
                :aria-label="$t('resizeStackPane')"
                @pointerdown="startStackResize"
                @keydown="handleStackResizeKeydown"
            ></button>

            <main ref="container" class="dashboard-main">
                <router-view v-slot="{ Component }">
                    <component
                        :is="Component"
                        :key="$route.fullPath"
                        :calculatedHeight="height"
                        @compose-focus-change="setComposeFocusMode"
                    />
                </router-view>
            </main>
        </div>
    </div>
</template>
```

- [ ] **Step 3: Replace the Dashboard script**

Replace the full `<script>` block in `frontend/src/pages/Dashboard.vue` with:

```vue
<script>
import StackList from "../components/StackList.vue";
import {
    DETAILS_PANE_CONFIG,
    STACK_PANE_CONFIG,
    readPaneWidth,
    shouldCollapseSecondaryPanes,
    writePaneWidth,
} from "../util-split-pane";

export default {
    components: {
        StackList,
    },
    data() {
        return {
            height: 0,
            stackPaneWidth: STACK_PANE_CONFIG.defaultWidth,
            detailsPaneWidthForLayout: DETAILS_PANE_CONFIG.defaultWidth,
            windowWidth: window.innerWidth,
            isResizingStackPane: false,
            composeFocusMode: false,
        };
    },
    computed: {
        shouldCollapseStackPane() {
            return shouldCollapseSecondaryPanes(this.windowWidth, this.stackPaneWidth, this.detailsPaneWidthForLayout);
        },
    },
    mounted() {
        this.height = this.$refs.container.offsetHeight;
        this.stackPaneWidth = readPaneWidth(window.localStorage, STACK_PANE_CONFIG);
        this.detailsPaneWidthForLayout = readPaneWidth(window.localStorage, DETAILS_PANE_CONFIG);
        window.addEventListener("resize", this.updateWindowWidth);
    },
    beforeUnmount() {
        window.removeEventListener("resize", this.updateWindowWidth);
        this.stopStackResize();
    },
    methods: {
        updateWindowWidth() {
            this.windowWidth = window.innerWidth;
            this.detailsPaneWidthForLayout = readPaneWidth(window.localStorage, DETAILS_PANE_CONFIG);
        },

        setComposeFocusMode(enabled) {
            this.composeFocusMode = enabled;
        },

        startStackResize(event) {
            this.isResizingStackPane = true;
            document.body.classList.add("resizing-pane");
            document.addEventListener("pointermove", this.handleStackResize);
            document.addEventListener("pointerup", this.stopStackResize);
            event.preventDefault();
        },

        handleStackResize(event) {
            if (!this.isResizingStackPane) {
                return;
            }

            const containerLeft = this.$el.getBoundingClientRect().left;
            this.setStackPaneWidth(event.clientX - containerLeft);
        },

        stopStackResize() {
            if (!this.isResizingStackPane) {
                return;
            }

            this.isResizingStackPane = false;
            document.body.classList.remove("resizing-pane");
            document.removeEventListener("pointermove", this.handleStackResize);
            document.removeEventListener("pointerup", this.stopStackResize);
        },

        setStackPaneWidth(width) {
            this.stackPaneWidth = writePaneWidth(window.localStorage, STACK_PANE_CONFIG, width);
        },

        handleStackResizeKeydown(event) {
            if (event.key === "ArrowLeft") {
                this.setStackPaneWidth(this.stackPaneWidth - 16);
                event.preventDefault();
            } else if (event.key === "ArrowRight") {
                this.setStackPaneWidth(this.stackPaneWidth + 16);
                event.preventDefault();
            }
        },
    },
};
</script>
```

- [ ] **Step 4: Replace the Dashboard scoped styles**

Replace the full `<style lang="scss" scoped>` block in `frontend/src/pages/Dashboard.vue` with:

```vue
<style lang="scss" scoped>
.dashboard-container {
    width: 98%;
}

.dashboard-shell {
    display: flex;
    align-items: stretch;
    min-width: 0;
}

.stack-pane {
    flex: 0 0 auto;
    min-width: 0;
    padding-right: 12px;
}

.dashboard-main {
    flex: 1 1 auto;
    min-width: 0;
    margin-bottom: 1rem;
}

.pane-resizer {
    flex: 0 0 10px;
    align-self: stretch;
    border: 0;
    border-radius: 0;
    background: transparent;
    cursor: col-resize;
    min-height: calc(100vh - 160px);
    padding: 0;
    position: relative;
}

.pane-resizer::before {
    background: rgba(120, 130, 140, 0.35);
    border-radius: 999px;
    content: "";
    inset: 0 4px;
    opacity: 0;
    position: absolute;
    transition: opacity 0.15s ease;
}

.pane-resizer:hover::before,
.pane-resizer:focus-visible::before {
    opacity: 1;
}

.pane-resizer:focus-visible {
    outline: 2px solid var(--bs-primary);
    outline-offset: 2px;
}

@media (max-width: 767.98px) {
    .dashboard-container {
        width: 100%;
    }

    .dashboard-shell {
        display: block;
    }
}
</style>
```

- [ ] **Step 5: Add the translation key in English**

Modify `frontend/src/lang/en.json` by adding this key in the existing JSON object:

```json
"resizeStackPane": "Resize stack pane"
```

If the file is alphabetized around nearby keys, keep the local ordering style instead of moving unrelated entries.

- [ ] **Step 6: Verify Dashboard compiles**

Run:

```bash
npm run lint -- frontend/src/pages/Dashboard.vue
node -e "const fs = require('node:fs'); JSON.parse(fs.readFileSync('frontend/src/lang/en.json', 'utf8'));"
npm run build:frontend
```

Expected: all three commands pass.

- [ ] **Step 7: Commit Task 2**

```bash
git add frontend/src/pages/Dashboard.vue frontend/src/lang/en.json
git commit -m "feat: add resizable dashboard stack pane"
```

---

### Task 3: Add Compose Details Pane State and Focus Events

**Files:**
- Modify: `frontend/src/pages/Compose.vue`
- Modify: `frontend/src/icon.ts`
- Test: `frontend/src/util-split-pane.test.ts`

- [ ] **Step 1: Confirm Compose has no focus event yet**

Run:

```bash
rg -n "compose-focus-change|detailsPaneWidth|composeFocusMode" frontend/src/pages/Compose.vue
```

Expected: no matches.

- [ ] **Step 2: Add split-pane imports**

In `frontend/src/pages/Compose.vue`, add this import after the existing local imports:

```js
import {
    DETAILS_PANE_CONFIG,
    readPaneWidth,
    writePaneWidth,
} from "../util-split-pane";
```

- [ ] **Step 3: Add component emits**

Inside `export default {`, directly after the `components` block, add:

```js
    emits: [
        "compose-focus-change",
    ],
```

- [ ] **Step 4: Add data fields**

Inside the returned object from `data()`, after `stopDockerStatsTimeout: false,`, add:

```js
            detailsPaneWidth: DETAILS_PANE_CONFIG.defaultWidth,
            isResizingDetailsPane: false,
            composeFocusMode: false,
```

- [ ] **Step 5: Initialize and clean up pane state**

In `mounted()`, before the `if (this.isAdd) {` block, add:

```js
        this.detailsPaneWidth = readPaneWidth(window.localStorage, DETAILS_PANE_CONFIG);
```

Replace the empty `unmounted()` method with:

```js
    unmounted() {
        this.stopDetailsResize();
        this.$emit("compose-focus-change", false);
    },
```

- [ ] **Step 6: Add details pane methods**

Inside `methods`, before `startServiceStatusTimeout()`, add:

```js
        toggleComposeFocusMode() {
            this.composeFocusMode = !this.composeFocusMode;
            this.$emit("compose-focus-change", this.composeFocusMode);
        },

        startDetailsResize(event) {
            if (this.composeFocusMode) {
                return;
            }

            this.isResizingDetailsPane = true;
            document.body.classList.add("resizing-pane");
            document.addEventListener("pointermove", this.handleDetailsResize);
            document.addEventListener("pointerup", this.stopDetailsResize);
            event.preventDefault();
        },

        handleDetailsResize(event) {
            if (!this.isResizingDetailsPane) {
                return;
            }

            const pageRight = this.$el.getBoundingClientRect().right;
            this.setDetailsPaneWidth(pageRight - event.clientX);
        },

        stopDetailsResize() {
            if (!this.isResizingDetailsPane) {
                return;
            }

            this.isResizingDetailsPane = false;
            document.body.classList.remove("resizing-pane");
            document.removeEventListener("pointermove", this.handleDetailsResize);
            document.removeEventListener("pointerup", this.stopDetailsResize);
        },

        setDetailsPaneWidth(width) {
            this.detailsPaneWidth = writePaneWidth(window.localStorage, DETAILS_PANE_CONFIG, width);
        },

        handleDetailsResizeKeydown(event) {
            if (event.key === "ArrowLeft") {
                this.setDetailsPaneWidth(this.detailsPaneWidth + 16);
                event.preventDefault();
            } else if (event.key === "ArrowRight") {
                this.setDetailsPaneWidth(this.detailsPaneWidth - 16);
                event.preventDefault();
            }
        },
```

- [ ] **Step 7: Add the translation keys in English**

Modify `frontend/src/lang/en.json` by adding these keys in the existing JSON object:

```json
"exitFocusMode": "Exit focus",
"focusEditor": "Focus editor",
"resizeDetailsPane": "Resize details pane"
```

- [ ] **Step 8: Verify script changes compile**

Run:

```bash
npm run lint -- frontend/src/pages/Compose.vue
node -e "const fs = require('node:fs'); JSON.parse(fs.readFileSync('frontend/src/lang/en.json', 'utf8'));"
npm run build:frontend
```

Expected: PASS. If the build fails because the template does not yet use the new methods, continue to Task 4 before committing and run the same commands there.

---

### Task 4: Reflow Compose Into Editor and Details Panes

**Files:**
- Modify: `frontend/src/pages/Compose.vue`

- [ ] **Step 1: Replace the managed-stack layout wrapper**

In `frontend/src/pages/Compose.vue`, replace the current block that starts at:

```vue
            <div v-if="stack.isManagedByDockge" class="row">
```

and ends at its matching closing `</div>` immediately before:

```vue
            <div v-if="!stack.isManagedByDockge && !processing">
```

Use this structure:

```vue
            <div
                v-if="stack.isManagedByDockge"
                class="compose-workbench"
                :class="{ 'compose-focus-mode': composeFocusMode }"
            >
                <section class="compose-editor-pane">
                    <div class="compose-editor-header">
                        <h4 class="mb-0">{{ stack.composeFileName }}</h4>
                        <button class="btn btn-normal btn-sm" type="button" @click="toggleComposeFocusMode">
                            <font-awesome-icon :icon="composeFocusMode ? 'compress' : 'expand'" class="me-1" />
                            {{ composeFocusMode ? $t("exitFocusMode") : $t("focusEditor") }}
                        </button>
                    </div>

                    <div class="shadow-box mb-3 editor-box compose-yaml-editor" :class="{ 'edit-mode' : isEditMode }">
                        <code-mirror
                            ref="editor"
                            v-model="stack.composeYAML"
                            :extensions="extensions"
                            minimal
                            wrap="true"
                            dark="true"
                            tab="true"
                            :disabled="!isEditMode"
                            :hasFocus="editorFocus"
                            @change="yamlCodeChange"
                        />
                    </div>
                </section>

                <button
                    v-if="!composeFocusMode"
                    class="pane-resizer details-resizer"
                    type="button"
                    role="separator"
                    aria-orientation="vertical"
                    :aria-label="$t('resizeDetailsPane')"
                    @pointerdown="startDetailsResize"
                    @keydown="handleDetailsResizeKeydown"
                ></button>

                <aside
                    v-if="!composeFocusMode"
                    class="compose-details-pane"
                    :style="{ width: `${detailsPaneWidth}px` }"
                >
                    <div v-if="isAdd" class="compose-details-section">
                        <h4 class="mb-3">{{ $t("general") }}</h4>
                        <div class="shadow-box big-padding mb-3">
                            <div>
                                <label for="name" class="form-label">{{ $t("stackName") }}</label>
                                <input id="name" v-model="stack.name" type="text" class="form-control" required @blur="stackNameToLowercase">
                                <div class="form-text">{{ $t("Lowercase only") }}</div>
                            </div>

                            <div class="mt-3">
                                <label for="name" class="form-label">{{ $t("dockgeAgent") }}</label>
                                <select v-model="stack.endpoint" class="form-select">
                                    <option v-for="(agent, agentEndpoint) in $root.agentList" :key="agentEndpoint" :value="agentEndpoint" :disabled="$root.agentStatusList[agentEndpoint] != 'online'">
                                        ({{ $root.agentStatusList[agentEndpoint] }}) {{ (agent.name !== '') ? agent.name : agent.url || $t("Current") }}
                                    </option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div v-if="isEditMode && yamlError" class="alert alert-danger py-2 mb-3">
                        {{ yamlError }}
                    </div>

                    <div class="compose-details-section">
                        <h4 class="mb-3">{{ $tc("container", 2) }}</h4>

                        <div v-if="isEditMode" class="input-group mb-3">
                            <input
                                v-model="newContainerName"
                                :placeholder="$t(`New Container Name...`)"
                                class="form-control"
                                @keyup.enter="addContainer"
                            />
                            <button class="btn btn-primary" @click="addContainer">
                                {{ $t("addContainer") }}
                            </button>
                        </div>

                        <div ref="containerList">
                            <Container
                                v-for="(service, name) in jsonConfig.services"
                                :key="name"
                                :name="name"
                                :is-edit-mode="isEditMode"
                                :first="name === Object.keys(jsonConfig.services)[0]"
                                :serviceStatus="serviceStatusList[name]"
                                :dockerStats="dockerStats"
                                @start-service="startService"
                                @stop-service="stopService"
                                @restart-service="restartService"
                            />
                        </div>
                    </div>

                    <div v-if="isEditMode" class="compose-details-section">
                        <h4 class="mb-3">{{ $t("extra") }}</h4>
                        <div class="shadow-box big-padding mb-3">
                            <div class="mb-4">
                                <label class="form-label">
                                    {{ $tc("url", 2) }}
                                </label>
                                <ArrayInput name="urls" :display-name="$t('url')" placeholder="https://" object-type="x-dockge" />
                            </div>
                        </div>
                    </div>

                    <div v-if="isEditMode" class="compose-details-section">
                        <h4 class="mb-3">.env</h4>
                        <div class="shadow-box mb-3 editor-box compose-env-editor" :class="{ 'edit-mode' : isEditMode }">
                            <code-mirror
                                ref="envEditor"
                                v-model="stack.composeENV"
                                :extensions="extensionsEnv"
                                minimal
                                wrap="true"
                                dark="true"
                                tab="true"
                                :disabled="!isEditMode"
                                :hasFocus="editorFocus"
                                @change="yamlCodeChange"
                            />
                        </div>
                    </div>

                    <div v-if="isEditMode" class="compose-details-section">
                        <h4 class="mb-3">{{ $tc("network", 2) }}</h4>
                        <div class="shadow-box big-padding mb-3">
                            <NetworkInput />
                        </div>
                    </div>

                    <div v-show="!isEditMode" class="compose-details-section">
                        <h4 class="mb-3">{{ $t("terminal") }}</h4>
                        <Terminal
                            ref="combinedTerminal"
                            class="mb-3 terminal"
                            :name="combinedTerminalName"
                            :endpoint="endpoint"
                            :rows="combinedTerminalRows"
                            :cols="combinedTerminalCols"
                            style="height: 315px;"
                        ></Terminal>
                    </div>
                </aside>
            </div>
```

- [ ] **Step 2: Verify removed duplicate editor refs**

Run:

```bash
rg -n "ref=\"editor\"|ref=\"envEditor\"" frontend/src/pages/Compose.vue
```

Expected: one `ref="editor"` for `composeYAML` and one `ref="envEditor"` for `composeENV`.

- [ ] **Step 3: Verify the old equal split is gone**

Run:

```bash
rg -n "col-lg-6|class=\"row\"" frontend/src/pages/Compose.vue
```

Expected: no matches in the compose workbench layout.

- [ ] **Step 4: Register focus icons**

Register the focus mode icons in `frontend/src/icon.ts` before building. Add `faCompress` and `faExpand` to the existing import from `@fortawesome/free-solid-svg-icons`:

```ts
    faCompress,
    faExpand,
```

Add both icons to the existing `library.add(...)` call:

```ts
    faCompress,
    faExpand,
```

- [ ] **Step 5: Run build and lint**

Run:

```bash
npm run lint -- frontend/src/pages/Compose.vue frontend/src/icon.ts
node -e "const fs = require('node:fs'); JSON.parse(fs.readFileSync('frontend/src/lang/en.json', 'utf8'));"
npm run build:frontend
```

Expected: PASS.

- [ ] **Step 6: Commit Tasks 3 and 4 together**

```bash
git add frontend/src/pages/Compose.vue frontend/src/icon.ts frontend/src/lang/en.json
git commit -m "feat: add compose editor split panes"
```

---

### Task 5: Add Compose Pane Styling and Mobile Fallback

**Files:**
- Modify: `frontend/src/pages/Compose.vue`
- Modify: `frontend/src/pages/Dashboard.vue`
- Modify: `frontend/src/styles/main.scss`

- [ ] **Step 1: Add Compose scoped styles**

In the existing scoped style block in `frontend/src/pages/Compose.vue`, keep `.terminal`, `.editor-box`, and `.agent-name`, then add:

```scss
.compose-workbench {
    align-items: stretch;
    display: flex;
    min-width: 0;
}

.compose-editor-pane {
    flex: 1 1 auto;
    min-width: 480px;
    padding-right: 12px;
}

.compose-editor-header {
    align-items: center;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    margin-bottom: 1rem;
    min-width: 0;
}

.compose-details-pane {
    flex: 0 0 auto;
    min-width: 0;
    padding-left: 12px;
}

.compose-details-section {
    min-width: 0;
}

.pane-resizer {
    flex: 0 0 10px;
    border: 0;
    background: transparent;
    cursor: col-resize;
    min-height: calc(100vh - 240px);
    padding: 0;
    position: relative;
}

.pane-resizer::before {
    background: rgba(120, 130, 140, 0.35);
    border-radius: 999px;
    content: "";
    inset: 0 4px;
    opacity: 0;
    position: absolute;
    transition: opacity 0.15s ease;
}

.pane-resizer:hover::before,
.pane-resizer:focus-visible::before {
    opacity: 1;
}

.pane-resizer:focus-visible {
    outline: 2px solid var(--bs-primary);
    outline-offset: 2px;
}

.compose-yaml-editor :deep(.cm-editor) {
    min-height: calc(100vh - 320px);
}

.compose-env-editor :deep(.cm-editor) {
    min-height: 180px;
}

.compose-focus-mode {
    .compose-editor-pane {
        min-width: 0;
        padding-right: 0;
    }

    .compose-yaml-editor :deep(.cm-editor) {
        min-height: calc(100vh - 260px);
    }
}

@media (max-width: 991.98px) {
    .compose-workbench {
        display: block;
    }

    .compose-editor-pane {
        min-width: 0;
        padding-right: 0;
    }

    .compose-details-pane {
        padding-left: 0;
        width: auto !important;
    }

    .pane-resizer {
        display: none;
    }

    .compose-yaml-editor :deep(.cm-editor) {
        min-height: 55vh;
    }
}
```

- [ ] **Step 2: Add global cursor guard**

In `frontend/src/styles/main.scss`, near the other global utility styles, add:

```scss
body.resizing-pane {
    cursor: col-resize;
    user-select: none;
}
```

- [ ] **Step 3: Run CSS and build checks**

Run:

```bash
npm run lint -- frontend/src/pages/Compose.vue frontend/src/pages/Dashboard.vue
npm run build:frontend
```

Expected: PASS.

- [ ] **Step 4: Commit Task 5**

```bash
git add frontend/src/pages/Compose.vue frontend/src/pages/Dashboard.vue frontend/src/styles/main.scss
git commit -m "style: polish compose split pane layout"
```

---

### Task 6: Verify the Full Split Pane UX

**Files:**
- Modify only if verification finds an issue in prior task files.

- [ ] **Step 1: Run the pure utility test**

Run:

```bash
node --import tsx --test frontend/src/util-split-pane.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Build the frontend**

Run:

```bash
npm run build:frontend
```

Expected: PASS and `frontend-dist` is produced.

- [ ] **Step 4: Start the frontend dev server**

Run:

```bash
npm run dev:frontend
```

Expected: Vite reports a local URL on port `5000`.

- [ ] **Step 5: Browser-check desktop layout**

Open `http://localhost:5000` in the in-app browser with a desktop viewport.

Verify:

- Stack pane appears on the left outside the compose editor.
- YAML editor is wider than before.
- Details pane appears on the right.
- Dragging the stack divider changes the stack pane width.
- Dragging the details divider changes the details pane width.
- Reloading preserves both widths.
- Keyboard focus on each divider shows an outline.
- Arrow keys resize the focused divider.

- [ ] **Step 6: Browser-check focus mode**

On a compose route, click `Focus editor`.

Verify:

- Stack pane disappears.
- Details pane disappears.
- YAML editor expands.
- `Exit focus` restores both panes.
- Compose text, `.env`, service status, and terminal state are not cleared by toggling focus.

- [ ] **Step 7: Browser-check mobile layout**

Use a narrow viewport at or below `390px` wide.

Verify:

- No draggable dividers are visible.
- YAML editor is not squeezed by the desktop split panes.
- Details content stacks below the editor.
- Buttons wrap without overlapping.

- [ ] **Step 8: Final status check**

Run:

```bash
git status --short
```

Expected: clean worktree after all commits.

If verification required fixes, commit them:

```bash
git add frontend/src/pages/Dashboard.vue frontend/src/pages/Compose.vue frontend/src/styles/main.scss frontend/src/lang/en.json frontend/src/util-split-pane.ts frontend/src/util-split-pane.test.ts
git commit -m "fix: complete compose split pane verification"
```
