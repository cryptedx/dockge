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
