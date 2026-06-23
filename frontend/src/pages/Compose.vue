<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 v-if="isAdd" class="mb-3">{{ $t("compose") }}</h1>
            <h1 v-else class="mb-3">
                <Uptime :stack="globalStack" :pill="true" /> {{ stack.name }}
                <span v-if="$root.agentCount > 1 && endpoint !== ''" class="agent-name">
                    ({{ endpointDisplay }})
                </span>
            </h1>

            <div v-if="stack.isManagedByDockge" class="mb-3">
                <div class="btn-group me-2" role="group">
                    <button v-if="isEditMode" class="btn btn-primary" :disabled="processing" @click="deployStack">
                        <font-awesome-icon icon="rocket" class="me-1" />
                        {{ $t("deployStack") }}
                    </button>

                    <button v-if="isEditMode" class="btn btn-normal" :disabled="processing" @click="saveStack">
                        <font-awesome-icon icon="save" class="me-1" />
                        {{ $t("saveStackDraft") }}
                    </button>

                    <button v-if="!isEditMode" class="btn btn-secondary" :disabled="processing" @click="enableEditMode">
                        <font-awesome-icon icon="pen" class="me-1" />
                        {{ $t("editStack") }}
                    </button>

                    <button v-if="!isEditMode && !active" class="btn btn-primary" :disabled="processing" @click="startStack">
                        <font-awesome-icon icon="play" class="me-1" />
                        {{ $t("startStack") }}
                    </button>

                    <button v-if="!isEditMode && active" class="btn btn-normal " :disabled="processing" @click="restartStack">
                        <font-awesome-icon icon="rotate" class="me-1" />
                        {{ $t("restartStack") }}
                    </button>

                    <button v-if="!isEditMode" class="btn btn-normal" :disabled="processing" @click="updateStack">
                        <font-awesome-icon icon="cloud-arrow-down" class="me-1" />
                        {{ $t("updateStack") }}
                    </button>

                    <button v-if="!isEditMode && active" class="btn btn-normal" :disabled="processing" @click="stopStack">
                        <font-awesome-icon icon="stop" class="me-1" />
                        {{ $t("stopStack") }}
                    </button>

                    <BDropdown right text="" variant="normal">
                        <BDropdownItem @click="downStack">
                            <font-awesome-icon icon="stop" class="me-1" />
                            {{ $t("downStack") }}
                        </BDropdownItem>
                    </BDropdown>
                </div>

                <button v-if="isEditMode && !isAdd" class="btn btn-normal" :disabled="processing" @click="discardStack">{{ $t("discardStack") }}</button>
                <button v-if="!isEditMode" class="btn btn-danger" :disabled="processing" @click="showDeleteDialog = !showDeleteDialog">
                    <font-awesome-icon icon="trash" class="me-1" />
                    {{ $t("deleteStack") }}
                </button>
            </div>

            <!-- URLs -->
            <div v-if="urls.length > 0" class="mb-3">
                <a v-for="(urlItem, index) in urls" :key="index" target="_blank" :href="urlItem.url">
                    <span class="badge bg-secondary me-2">{{ urlItem.display }}</span>
                </a>
            </div>

            <!-- Progress Terminal -->
            <transition name="slide-fade" appear>
                <Terminal
                    v-show="showProgressTerminal"
                    ref="progressTerminal"
                    class="mb-3 terminal"
                    :name="terminalName"
                    :endpoint="endpoint"
                    :rows="progressTerminalRows"
                    @has-data="showProgressTerminal = true; submitted = true;"
                ></Terminal>
            </transition>

            <div
                v-if="stack.isManagedByDockge"
                ref="composeWorkspace"
                class="compose-workspace"
                :class="{
                    'compose-focus-mode': composeFocusMode,
                    'compose-details-stacked': shouldStackDetailsPane,
                    'compose-terminal-expanded': showCombinedTerminalPanel && !combinedTerminalCollapsed,
                    'compose-terminal-collapsed': showCombinedTerminalPanel && combinedTerminalCollapsed,
                }"
            >
                <div class="compose-workbench">
                    <section ref="composeEditorPane" class="compose-editor-pane">
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

                        <div v-if="isEditMode && yamlError" class="alert alert-danger py-2 mb-3" role="alert">
                            {{ yamlError }}
                        </div>
                    </section>

                    <button
                        v-if="!composeFocusMode && !shouldStackDetailsPane"
                        class="pane-resizer details-resizer"
                        type="button"
                        tabindex="0"
                        role="separator"
                        aria-orientation="vertical"
                        :aria-label="$t('resizeDetailsPane')"
                        aria-controls="compose-details-pane"
                        :aria-valuemin="detailsPaneConfig.minWidth"
                        :aria-valuemax="detailsPaneConfig.maxWidth"
                        :aria-valuenow="detailsPaneWidth"
                        @pointerdown="startDetailsResize"
                        @keydown="handleDetailsResizeKeydown"
                    ></button>

                    <aside
                        v-show="!composeFocusMode"
                        id="compose-details-pane"
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

                        <div v-if="!isEditMode && !isAdd" class="compose-details-tabs mb-3" role="tablist" aria-label="Stack details">
                            <button
                                class="btn btn-sm"
                                :class="detailsTab === 'containers' ? 'btn-primary' : 'btn-normal'"
                                type="button"
                                role="tab"
                                :aria-selected="detailsTab === 'containers'"
                                @click="detailsTab = 'containers'"
                            >
                                {{ $tc("container", 2) }}
                            </button>
                            <button
                                class="btn btn-sm"
                                :class="detailsTab === 'updates' ? 'btn-primary' : 'btn-normal'"
                                type="button"
                                role="tab"
                                :aria-selected="detailsTab === 'updates'"
                                @click="detailsTab = 'updates'"
                            >
                                <font-awesome-icon icon="cloud-arrow-down" class="me-1" />
                                Updates
                                <span v-if="updateableServices.length > 0" class="badge bg-danger ms-1">{{ updateableServices.length }}</span>
                            </button>
                        </div>

                        <div v-if="isEditMode || detailsTab === 'containers'" class="compose-details-section">
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

                        <div v-if="!isEditMode && !isAdd && detailsTab === 'updates'" class="compose-details-section">
                            <div class="compose-updates-header mb-3">
                                <h4 class="mb-0">Updates</h4>
                                <button class="btn btn-normal btn-sm" type="button" :disabled="updateScanRunning || processing" @click="scanStackUpdates">
                                    <font-awesome-icon icon="search" class="me-1" />
                                    {{ updateScanRunning ? "Scanning" : "Scan" }}
                                </button>
                            </div>

                            <div class="shadow-box big-padding mb-3 update-panel">
                                <div v-if="!updateCheck && !updateScanRunning" class="update-empty">
                                    Scan this stack to compare local image digests with registry manifests.
                                </div>

                                <div v-if="updateScanRunning" class="update-empty">
                                    Checking registry manifests...
                                </div>

                                <div v-if="updateCheck && serviceUpdates.length === 0" class="update-empty">
                                    No image-backed services found.
                                </div>

                                <div v-for="service in serviceUpdates" :key="service.service" class="update-row">
                                    <label class="update-check">
                                        <input
                                            v-model="selectedUpdates[service.service]"
                                            class="form-check-input"
                                            type="checkbox"
                                            :disabled="service.status !== 'update-available' || processing"
                                        />
                                    </label>
                                    <div class="update-copy">
                                        <div class="update-title">
                                            <span>{{ service.service }}</span>
                                            <span class="badge" :class="updateBadgeClass(service.status)">{{ updateStatusLabel(service.status) }}</span>
                                        </div>
                                        <div class="update-image">{{ service.image }}</div>
                                        <div v-if="service.reason" class="update-reason">{{ service.reason }}</div>
                                    </div>
                                </div>

                                <button
                                    class="btn btn-primary w-100 mt-3"
                                    type="button"
                                    :disabled="selectedUpdateCount === 0 || processing"
                                    @click="applySelectedUpdates"
                                >
                                    <font-awesome-icon icon="cloud-arrow-down" class="me-1" />
                                    Update selected
                                </button>
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
                    </aside>
                </div>

                <section
                    v-show="showCombinedTerminalPanel"
                    class="compose-terminal-panel"
                    :class="{ 'is-collapsed': combinedTerminalCollapsed }"
                    :style="combinedTerminalPanelStyle"
                >
                    <div class="compose-terminal-header">
                        <h4 class="mb-0">{{ $t("terminal") }}</h4>
                        <button
                            class="btn btn-normal btn-sm"
                            type="button"
                            :aria-expanded="!combinedTerminalCollapsed"
                            :aria-label="combinedTerminalCollapsed ? 'Show terminal' : 'Hide terminal'"
                            @click="toggleCombinedTerminalPanel"
                        >
                            <font-awesome-icon :icon="combinedTerminalCollapsed ? 'chevron-up' : 'chevron-down'" />
                        </button>
                    </div>
                    <div v-show="!combinedTerminalCollapsed" class="compose-terminal-body">
                        <Terminal
                            ref="combinedTerminal"
                            class="terminal compose-bottom-terminal"
                            :name="combinedTerminalName"
                            :endpoint="endpoint"
                            :rows="combinedTerminalRows"
                            :cols="combinedTerminalCols"
                        ></Terminal>
                    </div>
                </section>
            </div>

            <div v-if="!stack.isManagedByDockge && !processing">
                {{ $t("stackNotManagedByDockgeMsg") }}
            </div>

            <!-- Delete Dialog -->
            <BModal v-model="showDeleteDialog" :cancelTitle="$t('cancel')" :okTitle="$t('deleteStack')" okVariant="danger" @ok="deleteDialog">
                {{ $t("deleteStackMsg") }}
            </BModal>
        </div>
    </transition>
</template>

<script>
import CodeMirror from "vue-codemirror6";
import { yaml } from "@codemirror/lang-yaml";
import { python } from "@codemirror/lang-python";
import { dracula as editorTheme } from "thememirror";
import { lineNumbers, EditorView } from "@codemirror/view";
import { parseDocument, Document } from "yaml";

import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import {
    COMBINED_TERMINAL_COLS,
    COMBINED_TERMINAL_ROWS,
    copyYAMLComments, envsubstYAML,
    getCombinedTerminalName,
    getComposeTerminalName,
    PROGRESS_TERMINAL_ROWS,
    RUNNING
} from "../../../common/util-common";
import { BDropdown, BDropdownItem, BModal } from "bootstrap-vue-next";
import NetworkInput from "../components/NetworkInput.vue";
import dotenv from "dotenv";
import { ref } from "vue";
import {
    DETAILS_PANE_CONFIG,
    readPaneWidth,
    shouldCollapseSecondaryPanes,
    writePaneWidth,
} from "../util-split-pane";
import {
    getMaintenanceSnapshotStack,
    MAINTENANCE_SNAPSHOT_KEY,
    parseMaintenanceSnapshot,
} from "../util-maintenance";

const template = `
services:
  nginx:
    image: nginx:latest
    restart: unless-stopped
    ports:
      - "8080:80"
`;
const envDefault = "# VARIABLE=value #comment";

let yamlErrorTimeout = null;

let serviceStatusTimeout = null;
let dockerStatsTimeout = null;
const COMBINED_TERMINAL_COLLAPSED_STORAGE_KEY = "dockgeCombinedTerminalCollapsed";

export default {
    components: {
        NetworkInput,
        FontAwesomeIcon,
        CodeMirror,
        BDropdown,
        BDropdownItem,
        BModal,
    },
    beforeRouteUpdate(to, from, next) {
        this.exitConfirm(next);
    },
    beforeRouteLeave(to, from, next) {
        this.exitConfirm(next);
    },
    emits: [
        "compose-focus-change",
        "compose-details-width-change",
    ],
    setup() {
        const editorFocus = ref(false);

        const focusEffectHandler = (state, focusing) => {
            editorFocus.value = focusing;
            return null;
        };

        const extensions = [
            editorTheme,
            yaml(),
            lineNumbers(),
            EditorView.focusChangeEffect.of(focusEffectHandler)
        ];

        const extensionsEnv = [
            editorTheme,
            python(),
            lineNumbers(),
            EditorView.focusChangeEffect.of(focusEffectHandler)
        ];

        return { extensions,
            extensionsEnv,
            editorFocus };
    },
    yamlDoc: null,  // For keeping the yaml comments
    combinedTerminalPanelBoundsFrame: null,
    combinedTerminalPanelResizeObserver: null,
    combinedTerminalPanelResizeAnchor: null,
    data() {
        return {
            jsonConfig: {},
            envsubstJSONConfig: {},
            yamlError: "",
            processing: true,
            showProgressTerminal: false,
            progressTerminalRows: PROGRESS_TERMINAL_ROWS,
            combinedTerminalRows: COMBINED_TERMINAL_ROWS,
            combinedTerminalCols: COMBINED_TERMINAL_COLS,
            combinedTerminalCollapsed: window.localStorage.getItem(COMBINED_TERMINAL_COLLAPSED_STORAGE_KEY) === "true",
            combinedTerminalPanelStyle: {},
            stack: {

            },
            serviceStatusList: {},
            dockerStats: {},
            isEditMode: false,
            submitted: false,
            showDeleteDialog: false,
            newContainerName: "",
            stopServiceStatusTimeout: false,
            stopDockerStatsTimeout: false,
            detailsPaneConfig: DETAILS_PANE_CONFIG,
            detailsPaneWidth: DETAILS_PANE_CONFIG.defaultWidth,
            isResizingDetailsPane: false,
            composeFocusMode: false,
            windowWidth: window.innerWidth,
            detailsTab: "containers",
            updateCheck: null,
            updateScanRunning: false,
            selectedUpdates: {},
        };
    },
    computed: {
        shouldStackDetailsPane() {
            return !this.composeFocusMode && shouldCollapseSecondaryPanes(this.windowWidth, 0, this.detailsPaneWidth);
        },

        showCombinedTerminalPanel() {
            return !this.isEditMode && !this.composeFocusMode;
        },

        endpointDisplay() {
            return this.$root.endpointDisplayFunction(this.endpoint);
        },

        urls() {
            if (!this.envsubstJSONConfig["x-dockge"] || !this.envsubstJSONConfig["x-dockge"].urls || !Array.isArray(this.envsubstJSONConfig["x-dockge"].urls)) {
                return [];
            }

            let urls = [];
            for (const url of this.envsubstJSONConfig["x-dockge"].urls) {
                let display;
                try {
                    let obj = new URL(url);
                    let pathname = obj.pathname;
                    if (pathname === "/") {
                        pathname = "";
                    }
                    display = obj.host + pathname + obj.search;
                } catch (e) {
                    display = url;
                }

                urls.push({
                    display,
                    url,
                });
            }
            return urls;
        },

        serviceUpdates() {
            return this.updateCheck?.services || [];
        },

        updateableServices() {
            return this.serviceUpdates.filter((service) => service.status === "update-available");
        },

        selectedUpdateCount() {
            return Object.values(this.selectedUpdates).filter(Boolean).length;
        },

        isAdd() {
            return this.$route.path === "/compose" && !this.submitted;
        },

        /**
         * Get the stack from the global stack list, because it may contain more real-time data like status
         * @return {*}
         */
        globalStack() {
            return this.$root.completeStackList[this.stack.name + "_" + this.endpoint];
        },

        status() {
            return this.globalStack?.status;
        },

        active() {
            return this.status === RUNNING;
        },

        terminalName() {
            if (!this.stack.name) {
                return "";
            }
            return getComposeTerminalName(this.endpoint, this.stack.name);
        },

        combinedTerminalName() {
            if (!this.stack.name) {
                return "";
            }
            return getCombinedTerminalName(this.endpoint, this.stack.name);
        },

        networks() {
            return this.jsonConfig.networks;
        },

        endpoint() {
            return this.stack.endpoint || this.$route.params.endpoint || "";
        },

        url() {
            if (this.stack.endpoint) {
                return `/compose/${this.stack.name}/${this.stack.endpoint}`;
            } else {
                return `/compose/${this.stack.name}`;
            }
        },
    },
    watch: {
        "stack.composeYAML": {
            handler() {
                if (this.editorFocus) {
                    console.debug("yaml code changed");
                    this.yamlCodeChange();
                }
            },
            deep: true,
        },

        "stack.composeENV": {
            handler() {
                if (this.editorFocus) {
                    console.debug("env code changed");
                    this.yamlCodeChange();
                }
            },
            deep: true,
        },

        jsonConfig: {
            handler() {
                if (!this.editorFocus) {
                    console.debug("jsonConfig changed");

                    let doc = new Document(this.jsonConfig);

                    // Stick back the yaml comments
                    if (this.yamlDoc) {
                        copyYAMLComments(doc, this.yamlDoc);
                    }

                    this.stack.composeYAML = doc.toString();
                    this.yamlDoc = doc;
                }
            },
            deep: true,
        },

        $route(to, from) {

        }
    },
    mounted() {
        this.detailsPaneWidth = readPaneWidth(window.localStorage, DETAILS_PANE_CONFIG);
        this.$emit("compose-details-width-change", this.detailsPaneWidth);

        if (this.isAdd) {
            this.processing = false;
            this.isEditMode = true;

            let composeYAML;
            let composeENV;

            if (this.$root.composeTemplate) {
                composeYAML = this.$root.composeTemplate;
                this.$root.composeTemplate = "";
            } else {
                composeYAML = template;
            }
            if (this.$root.envTemplate) {
                composeENV = this.$root.envTemplate;
                this.$root.envTemplate = "";
            } else {
                composeENV = envDefault;
            }

            // Default Values
            this.stack = {
                name: "",
                composeYAML,
                composeENV,
                isManagedByDockge: true,
                endpoint: "",
            };

            this.yamlCodeChange();

        } else {
            this.stack.name = this.$route.params.stackName;
            this.loadStack();
        }

        this.requestServiceStatus();
        this.requestDockerStats();
        this.scheduleCombinedTerminalPanelBoundsUpdate();
        window.addEventListener("resize", this.updateWindowWidth);
        window.addEventListener("keydown", this.handleGlobalTerminalShortcut);
    },
    updated() {
        this.scheduleCombinedTerminalPanelBoundsUpdate();
    },
    unmounted() {
        this.stopDetailsResize();
        this.$emit("compose-focus-change", false);
        if (this.combinedTerminalPanelBoundsFrame !== null) {
            cancelAnimationFrame(this.combinedTerminalPanelBoundsFrame);
            this.combinedTerminalPanelBoundsFrame = null;
        }
        this.combinedTerminalPanelResizeObserver?.disconnect();
        this.combinedTerminalPanelResizeObserver = null;
        this.combinedTerminalPanelResizeAnchor = null;
        window.removeEventListener("resize", this.updateWindowWidth);
        window.removeEventListener("keydown", this.handleGlobalTerminalShortcut);
    },
    methods: {
        updateWindowWidth() {
            this.windowWidth = window.innerWidth;
            this.scheduleCombinedTerminalPanelBoundsUpdate();
        },

        scheduleCombinedTerminalPanelBoundsUpdate() {
            this.$nextTick(() => {
                if (this.combinedTerminalPanelBoundsFrame !== null) {
                    cancelAnimationFrame(this.combinedTerminalPanelBoundsFrame);
                }

                this.combinedTerminalPanelBoundsFrame = requestAnimationFrame(() => {
                    this.combinedTerminalPanelBoundsFrame = null;
                    this.observeCombinedTerminalPanelAnchor();
                    this.updateCombinedTerminalPanelBounds();
                });
            });
        },

        observeCombinedTerminalPanelAnchor() {
            const anchor = this.$refs.composeEditorPane || this.$refs.composeWorkspace;

            if (!anchor || typeof ResizeObserver === "undefined") {
                return;
            }

            if (!this.combinedTerminalPanelResizeObserver) {
                this.combinedTerminalPanelResizeObserver = new ResizeObserver(() => {
                    this.scheduleCombinedTerminalPanelBoundsUpdate();
                });
            }

            if (this.combinedTerminalPanelResizeAnchor === anchor) {
                return;
            }

            this.combinedTerminalPanelResizeObserver.disconnect();
            this.combinedTerminalPanelResizeAnchor = anchor;
            this.combinedTerminalPanelResizeObserver.observe(anchor);
        },

        updateCombinedTerminalPanelBounds() {
            const workspace = this.$refs.composeWorkspace;
            const anchor = this.$refs.composeEditorPane || workspace;

            if (!anchor) {
                return;
            }

            const { left, width } = anchor.getBoundingClientRect();
            const nextStyle = {
                left: `${Math.max(left, 0)}px`,
                width: `${Math.max(width, 0)}px`,
            };

            if (this.combinedTerminalPanelStyle.left !== nextStyle.left || this.combinedTerminalPanelStyle.width !== nextStyle.width) {
                this.combinedTerminalPanelStyle = nextStyle;
                this.$nextTick(() => {
                    this.$refs.combinedTerminal?.updateTerminalSize?.();
                });
            }
        },

        toggleComposeFocusMode() {
            this.composeFocusMode = !this.composeFocusMode;
            this.$emit("compose-focus-change", this.composeFocusMode);
            this.scheduleCombinedTerminalPanelBoundsUpdate();
        },

        startDetailsResize(event) {
            if (this.composeFocusMode || this.shouldStackDetailsPane) {
                return;
            }

            this.isResizingDetailsPane = true;
            document.body.classList.add("resizing-pane");
            document.addEventListener("pointermove", this.handleDetailsResize);
            document.addEventListener("pointerup", this.stopDetailsResize);
            document.addEventListener("pointercancel", this.stopDetailsResize);
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
            document.removeEventListener("pointercancel", this.stopDetailsResize);
        },

        setDetailsPaneWidth(width) {
            this.detailsPaneWidth = writePaneWidth(window.localStorage, DETAILS_PANE_CONFIG, width);
            this.$emit("compose-details-width-change", this.detailsPaneWidth);
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

        startServiceStatusTimeout() {
            clearTimeout(serviceStatusTimeout);
            serviceStatusTimeout = setTimeout(async () => {
                this.requestServiceStatus();
            }, 5000);
        },

        startDockerStatsTimeout() {
            clearTimeout(dockerStatsTimeout);
            dockerStatsTimeout = setTimeout(async () => {
                this.requestDockerStats();
            }, 5000);
        },

        requestServiceStatus() {
            // Do not request if it is add mode
            if (this.isAdd) {
                return;
            }

            this.$root.emitAgent(this.endpoint, "serviceStatusList", this.stack.name, (res) => {
                if (res.ok) {
                    this.serviceStatusList = res.serviceStatusList;
                }
                if (!this.stopServiceStatusTimeout) {
                    this.startServiceStatusTimeout();
                }
            });
        },

        requestDockerStats() {
            this.$root.emitAgent(this.endpoint, "dockerStats", (res) => {
                if (res.ok) {
                    this.dockerStats = res.dockerStats;
                }
                if (!this.stopDockerStatsTimeout) {
                    this.startDockerStatsTimeout();
                }
            });
        },

        exitConfirm(next) {
            if (this.isEditMode) {
                if (confirm(this.$t("confirmLeaveStack"))) {
                    this.exitAction();
                    next();
                } else {
                    next(false);
                }
            } else {
                this.exitAction();
                next();
            }
        },

        exitAction() {
            console.log("exitAction");
            this.stopServiceStatusTimeout = true;
            this.stopDockerStatsTimeout = true;
            clearTimeout(serviceStatusTimeout);
            clearTimeout(dockerStatsTimeout);

            // Leave Combined Terminal
            console.debug("leaveCombinedTerminal", this.endpoint, this.stack.name);
            this.$root.emitAgent(this.endpoint, "leaveCombinedTerminal", this.stack.name, () => {});
        },

        bindTerminal() {
            this.$refs.progressTerminal?.bind(this.endpoint, this.terminalName);
        },

        toggleCombinedTerminalPanel() {
            this.combinedTerminalCollapsed = !this.combinedTerminalCollapsed;
            window.localStorage.setItem(COMBINED_TERMINAL_COLLAPSED_STORAGE_KEY, String(this.combinedTerminalCollapsed));

            if (!this.combinedTerminalCollapsed) {
                this.$nextTick(() => {
                    this.$refs.combinedTerminal?.updateTerminalSize?.();
                });
            }
        },

        handleGlobalTerminalShortcut(event) {
            const isTerminalShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j";

            if (!isTerminalShortcut) {
                return;
            }

            if (!this.showCombinedTerminalPanel) {
                return;
            }

            event.preventDefault();
            this.toggleCombinedTerminalPanel();
        },

        loadStack() {
            this.processing = true;
            this.$root.emitAgent(this.endpoint, "getStack", this.stack.name, (res) => {
                if (res.ok) {
                    this.stack = res.stack;
                    this.restoreUpdateCheck();
                    this.detailsTab = "containers";
                    this.yamlCodeChange();
                    this.processing = false;
                    this.bindTerminal();
                    this.scheduleCombinedTerminalPanelBoundsUpdate();
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        deployStack() {
            this.processing = true;

            if (!this.jsonConfig.services) {
                this.$root.toastError("No services found in compose.yaml");
                this.processing = false;
                return;
            }

            // Check if services is object
            if (typeof this.jsonConfig.services !== "object") {
                this.$root.toastError("Services must be an object");
                this.processing = false;
                return;
            }

            let serviceNameList = Object.keys(this.jsonConfig.services);

            // Set the stack name if empty, use the first container name
            if (!this.stack.name && serviceNameList.length > 0) {
                let serviceName = serviceNameList[0];
                let service = this.jsonConfig.services[serviceName];

                if (service && service.container_name) {
                    this.stack.name = service.container_name;
                } else {
                    this.stack.name = serviceName;
                }
            }

            this.bindTerminal();

            this.$root.emitAgent(this.stack.endpoint, "deployStack", this.stack.name, this.stack.composeYAML, this.stack.composeENV, this.isAdd, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.isEditMode = false;
                    this.$router.push(this.url);
                }
            });
        },

        saveStack() {
            this.processing = true;

            this.$root.emitAgent(this.stack.endpoint, "saveStack", this.stack.name, this.stack.composeYAML, this.stack.composeENV, this.isAdd, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.isEditMode = false;
                    this.$router.push(this.url);
                }
            });
        },

        startStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "startStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        stopStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "stopStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        downStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "downStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        restartStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "restartStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        updateStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "updateStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        scanStackUpdates() {
            this.updateScanRunning = true;
            this.selectedUpdates = {};

            this.$root.emitAgent(this.endpoint, "checkStackUpdates", this.stack.name, (res) => {
                this.updateScanRunning = false;
                if (res.ok) {
                    this.updateCheck = res.updates;
                    this.selectUpdateableServices();
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        applySelectedUpdates() {
            const serviceNames = Object.entries(this.selectedUpdates)
                .filter((entry) => entry[1])
                .map((entry) => entry[0]);

            if (serviceNames.length === 0) {
                return;
            }

            this.processing = true;
            this.$root.emitAgent(this.endpoint, "applyStackUpdates", this.stack.name, serviceNames, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.scanStackUpdates();
                }
            });
        },

        updateStatusLabel(status) {
            if (status === "update-available") {
                return "Update";
            }
            if (status === "current") {
                return "Current";
            }
            return "Unknown";
        },

        updateBadgeClass(status) {
            if (status === "update-available") {
                return "bg-danger";
            }
            if (status === "current") {
                return "bg-success";
            }
            return "bg-secondary";
        },

        restoreUpdateCheck() {
            this.updateCheck = getMaintenanceSnapshotStack(
                parseMaintenanceSnapshot(localStorage.getItem(MAINTENANCE_SNAPSHOT_KEY)),
                this.endpoint,
                this.stack.name
            ) || null;
            this.selectUpdateableServices();
        },

        selectUpdateableServices() {
            this.selectedUpdates = {};
            for (const service of this.updateableServices) {
                this.selectedUpdates[service.service] = true;
            }
        },

        deleteDialog() {
            this.$root.emitAgent(this.endpoint, "deleteStack", this.stack.name, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.$router.push("/");
                }
            });
        },

        discardStack() {
            this.loadStack();
            this.isEditMode = false;
        },

        yamlToJSON(yaml) {
            let doc = parseDocument(yaml);
            if (doc.errors.length > 0) {
                throw doc.errors[0];
            }

            const config = doc.toJS() ?? {};

            // Check data types
            // "services" must be an object
            if (!config.services) {
                config.services = {};
            }

            if (Array.isArray(config.services) || typeof config.services !== "object") {
                throw new Error("Services must be an object");
            }

            return {
                config,
                doc,
            };
        },

        yamlCodeChange() {
            try {
                let { config, doc } = this.yamlToJSON(this.stack.composeYAML);

                this.yamlDoc = doc;
                this.jsonConfig = config;

                let env = dotenv.parse(this.stack.composeENV);
                let envYAML = envsubstYAML(this.stack.composeYAML, env);
                this.envsubstJSONConfig = this.yamlToJSON(envYAML).config;

                clearTimeout(yamlErrorTimeout);
                this.yamlError = "";
            } catch (e) {
                clearTimeout(yamlErrorTimeout);

                if (this.yamlError) {
                    this.yamlError = e.message;

                } else {
                    yamlErrorTimeout = setTimeout(() => {
                        this.yamlError = e.message;
                    }, 3000);
                }
            }
        },

        enableEditMode() {
            this.isEditMode = true;
        },

        checkYAML() {

        },

        addContainer() {
            this.checkYAML();

            if (this.jsonConfig.services[this.newContainerName]) {
                this.$root.toastError("Container name already exists");
                return;
            }

            if (!this.newContainerName) {
                this.$root.toastError("Container name cannot be empty");
                return;
            }

            this.jsonConfig.services[this.newContainerName] = {
                restart: "unless-stopped",
            };
            this.newContainerName = "";
            let element = this.$refs.containerList.lastElementChild;
            element.scrollIntoView({
                block: "start",
                behavior: "smooth"
            });
        },

        stackNameToLowercase() {
            this.stack.name = this.stack?.name?.toLowerCase();
        },

        startService(serviceName) {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "startService", this.stack.name, serviceName, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.requestServiceStatus(); // Refresh service status
                }
            });
        },

        stopService(serviceName) {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "stopService", this.stack.name, serviceName, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.requestServiceStatus(); // Refresh service status
                }
            });
        },

        restartService(serviceName) {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "restartService", this.stack.name, serviceName, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.requestServiceStatus(); // Refresh service status
                }
            });
        },
    }
};
</script>

<style scoped lang="scss">
@import "../styles/vars.scss";

.terminal {
    height: 200px;
}

.editor-box {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
}

.compose-workspace {
    min-width: 0;
}

.compose-workspace.compose-terminal-expanded {
    padding-bottom: calc(clamp(320px, 34vh, 460px) + 74px);
}

.compose-workspace.compose-terminal-collapsed {
    padding-bottom: 74px;
}

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

.compose-details-tabs {
    display: flex;
    gap: 8px;
    min-width: 0;
}

.compose-details-tabs .btn {
    align-items: center;
    display: inline-flex;
    justify-content: center;
    min-width: 0;
}

.compose-updates-header,
.update-title {
    align-items: center;
    display: flex;
    gap: 10px;
    justify-content: space-between;
    min-width: 0;
}

.update-panel {
    min-width: 0;
}

.update-empty {
    color: $dark-font-color2;
    font-size: 0.9rem;
}

.update-row {
    align-items: flex-start;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    gap: 10px;
    padding: 10px 0;
}

.update-row:first-of-type {
    padding-top: 0;
}

.update-row:last-of-type {
    border-bottom: 0;
    padding-bottom: 0;
}

.update-check {
    display: flex;
    padding-top: 3px;
}

.update-copy {
    min-width: 0;
    width: 100%;
}

.update-title span:first-child,
.update-image,
.update-reason {
    overflow-wrap: anywhere;
}

.update-title span:first-child {
    font-weight: 600;
}

.update-image,
.update-reason {
    color: $dark-font-color2;
    font-size: 0.82rem;
    line-height: 1.35;
    margin-top: 4px;
}

.compose-terminal-panel {
    background: $dark-bg;
    border-radius: 18px 18px 0 0;
    bottom: 0;
    box-shadow: 0 -16px 32px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.06);
    margin-top: 8px;
    min-width: 0;
    padding: 12px 12px 0;
    position: fixed;
    z-index: 20;
}

.compose-terminal-panel.is-collapsed {
    padding-bottom: 12px;
}

.compose-terminal-header {
    align-items: center;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    min-width: 0;
}

.compose-terminal-header .btn {
    align-items: center;
    display: inline-flex;
    justify-content: center;
    min-height: 40px;
    min-width: 40px;
    padding: 0;
}

.compose-terminal-body {
    min-width: 0;
    width: 100%;
}

.compose-bottom-terminal {
    box-sizing: border-box;
    display: block;
    height: clamp(320px, 34vh, 460px);
    margin-bottom: 0;
    width: 100%;
}

.compose-bottom-terminal :deep(.main-terminal),
.compose-bottom-terminal :deep(.xterm) {
    width: 100%;
}

.compose-yaml-editor,
.compose-env-editor {
    min-width: 0;
}

.compose-yaml-editor :deep(.cm-editor) {
    min-height: calc(100vh - 320px);
}

.compose-env-editor :deep(.cm-editor) {
    min-height: 180px;
}

.compose-focus-mode {
    .details-resizer,
    .compose-details-pane {
        display: none !important;
    }

    .compose-editor-pane {
        min-width: 0;
        padding-right: 0;
    }

    .compose-yaml-editor :deep(.cm-editor) {
        min-height: calc(100vh - 260px);
    }
}

.compose-details-stacked {
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

.agent-name {
    font-size: 13px;
    color: $dark-font-color3;
}
</style>
