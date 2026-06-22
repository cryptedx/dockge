<template>
    <div class="shadow-box mb-3" :style="boxStyle">
        <div class="list-header">
            <div class="header-top">
                <!-- TODO -->
                <button
                    v-if="false" class="btn btn-outline-normal ms-2" :class="{ 'active': selectMode }" type="button"
                    @click="selectMode = !selectMode"
                >
                    {{ $t("Select") }}
                </button>

                <div class="placeholder"></div>
                <div class="search-wrapper">
                    <a v-if="searchText == ''" class="search-icon" @click="openProjectSearch">
                        <font-awesome-icon icon="search" />
                    </a>
                    <a v-if="searchText != ''" class="search-icon" style="cursor: pointer" @click="clearSearchText">
                        <font-awesome-icon icon="times" />
                    </a>
                    <form @submit.prevent="openProjectSearchFromInput">
                        <input
                            ref="stackSearchInput"
                            v-model="searchText"
                            class="form-control search-input"
                            autocomplete="off"
                            :placeholder="stackSearchPlaceholder"
                            @focus="openProjectSearchFromInput"
                        />
                    </form>
                </div>
            </div>

            <!-- TODO -->
            <div v-if="false" class="header-filter">
                <!--<StackListFilter :filterState="filterState" @update-filter="updateFilter" />-->
            </div>

            <!-- TODO: Selection Controls -->
            <div v-if="selectMode && false" class="selection-controls px-2 pt-2">
                <input v-model="selectAll" class="form-check-input select-input" type="checkbox" />

                <button class="btn-outline-normal" @click="pauseDialog">
                    <font-awesome-icon icon="pause" size="sm" /> {{
                        $t("Pause") }}
                </button>
                <button class="btn-outline-normal" @click="resumeSelected">
                    <font-awesome-icon icon="play" size="sm" />
                    {{ $t("Resume") }}
                </button>

                <span v-if="selectedStackCount > 0">
                    {{ $t("selectedStackCount", [selectedStackCount]) }}
                </span>
            </div>
        </div>
        <div ref="stackList" class="stack-list" :class="{ scrollbar: scrollbar }" :style="stackListStyle">
            <div v-if="agentStackList[0] && agentStackList[0].stacks.length === 0" class="text-center mt-3">
                <router-link to="/compose">{{ $t("addFirstStackMsg") }}</router-link>
            </div>
            <div v-for="(agent, agentIndex) in agentStackList" :key="agentIndex" class="stack-list-inner">
                <div
                    v-if="$root.agentCount > 1" class="p-2 agent-select"
                    @click="closedAgents.set(agent.endpoint, !closedAgents.get(agent.endpoint))"
                >
                    <span class="me-1">
                        <font-awesome-icon v-show="closedAgents.get(agent.endpoint)" icon="chevron-circle-right" />
                        <font-awesome-icon v-show="!closedAgents.get(agent.endpoint)" icon="chevron-circle-down" />
                    </span>
                    <span v-if="agent.endpoint === 'current'">{{ $t("currentEndpoint") }}</span>
                    <span v-else>{{ agent.endpoint }}</span>
                </div>
                <StackListItem
                    v-for="(item, index) in agent.stacks"
                    v-show="$root.agentCount === 1 || !closedAgents.get(agent.endpoint)" :key="index" :stack="item" :isSelectMode="selectMode"
                    :isSelected="isSelected" :select="select" :deselect="deselect"
                />
            </div>
        </div>
    </div>

    <transition name="project-search-fade">
        <div v-if="showProjectSearch" class="project-search-backdrop" @mousedown.self="closeProjectSearch">
            <div class="project-search-dialog" role="dialog" aria-modal="true" aria-label="Compose-Projekte suchen">
                <div class="project-search-input-row">
                    <font-awesome-icon icon="search" class="project-search-icon" />
                    <input
                        ref="projectSearchInput"
                        v-model="projectSearchQuery"
                        class="project-search-input"
                        type="search"
                        placeholder="Compose-Projekt suchen"
                        role="combobox"
                        aria-controls="project-search-results"
                        :aria-expanded="showProjectSearch"
                        :aria-activedescendant="projectSearchActiveItemId"
                        autocomplete="off"
                        @keydown="handleProjectSearchKeydown"
                    />
                    <button class="btn btn-normal btn-sm project-search-close" type="button" aria-label="Projektsuche schliessen" @click="closeProjectSearch">
                        <font-awesome-icon icon="times" />
                    </button>
                </div>

                <div id="project-search-results" class="project-search-results" role="listbox">
                    <button
                        v-for="(item, index) in filteredProjectSearchItems"
                        :id="getProjectSearchItemId(item.key)"
                        :key="item.key"
                        class="project-search-result"
                        :class="{ 'is-active': index === projectSearchIndex }"
                        type="button"
                        role="option"
                        :aria-selected="index === projectSearchIndex"
                        @mouseenter="projectSearchIndex = index"
                        @mousedown.prevent="selectProjectSearchItem(item)"
                    >
                        <span class="project-search-result-name">{{ item.name }}</span>
                        <span class="project-search-result-meta">
                            <span class="badge" :class="item.badgeClass">{{ item.statusLabel }}</span>
                            <span class="project-search-endpoint">{{ item.endpointLabel }}</span>
                        </span>
                    </button>

                    <div v-if="filteredProjectSearchItems.length === 0" class="project-search-empty">
                        Keine Compose-Projekte gefunden
                    </div>
                </div>
            </div>
        </div>
    </transition>

    <Confirm ref="confirmPause" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="pauseSelected">
        {{ $t("pauseStackMsg") }}
    </Confirm>
</template>

<script>
import Confirm from "../components/Confirm.vue";
import StackListItem from "../components/StackListItem.vue";
import { CREATED_FILE, CREATED_STACK, EXITED, RUNNING, UNKNOWN, statusColor, statusNameShort } from "../../../common/util-common";

export default {
    components: {
        Confirm,
        StackListItem,
    },
    props: {
        /** Should the scrollbar be shown */
        scrollbar: {
            type: Boolean,
        },
    },
    data() {
        return {
            searchText: "",
            showProjectSearch: false,
            projectSearchQuery: "",
            projectSearchIndex: 0,
            selectMode: false,
            selectAll: false,
            disableSelectAllWatcher: false,
            selectedStacks: {},
            windowTop: 0,
            filterState: {
                status: null,
                active: null,
                tags: null,
            },
            closedAgents: new Map(),
        };
    },
    computed: {
        /**
         * Improve the sticky appearance of the list by increasing its
         * height as user scrolls down.
         * Not used on mobile.
         * @returns {object} Style for stack list
         */
        boxStyle() {
            if (window.innerWidth > 550) {
                return {
                    height: `calc(100vh - 160px + ${this.windowTop}px)`,
                };
            } else {
                return {
                    height: "calc(100vh - 160px)",
                };
            }

        },

        /**
         * Returns a sorted list of stacks based on the applied filters and search text.
         * @returns {Array} The sorted list of stacks.
         */
        agentStackList() {
            let result = Object.values(this.$root.completeStackList);

            result = result.filter(stack => {
                // filter by search text
                // finds stack name, tag name or tag value
                let searchTextMatch = true;
                if (this.searchText !== "") {
                    const loweredSearchText = this.searchText.toLowerCase();
                    searchTextMatch =
                        stack.name.toLowerCase().includes(loweredSearchText)
                        || stack.tags.find(tag => tag.name.toLowerCase().includes(loweredSearchText)
                            || tag.value?.toLowerCase().includes(loweredSearchText));
                }

                // filter by active
                let activeMatch = true;
                if (this.filterState.active != null && this.filterState.active.length > 0) {
                    activeMatch = this.filterState.active.includes(stack.active);
                }

                // filter by tags
                let tagsMatch = true;
                if (this.filterState.tags != null && this.filterState.tags.length > 0) {
                    tagsMatch = stack.tags.map(tag => tag.tag_id) // convert to array of tag IDs
                        .filter(stackTagId => this.filterState.tags.includes(stackTagId)) // perform Array Intersaction between filter and stack's tags
                        .length > 0;
                }

                return searchTextMatch && activeMatch && tagsMatch;
            });

            result.sort((m1, m2) => {

                // sort by managed by dockge
                if (m1.isManagedByDockge && !m2.isManagedByDockge) {
                    return -1;
                } else if (!m1.isManagedByDockge && m2.isManagedByDockge) {
                    return 1;
                }

                // sort by status
                if (m1.status !== m2.status) {
                    if (m2.status === RUNNING) {
                        return 1;
                    } else if (m1.status === RUNNING) {
                        return -1;
                    } else if (m2.status === EXITED) {
                        return 1;
                    } else if (m1.status === EXITED) {
                        return -1;
                    } else if (m2.status === CREATED_STACK) {
                        return 1;
                    } else if (m1.status === CREATED_STACK) {
                        return -1;
                    } else if (m2.status === CREATED_FILE) {
                        return 1;
                    } else if (m1.status === CREATED_FILE) {
                        return -1;
                    } else if (m2.status === UNKNOWN) {
                        return 1;
                    } else if (m1.status === UNKNOWN) {
                        return -1;
                    }
                }
                return m1.name.localeCompare(m2.name);
            });

            // Group stacks by endpoint, sorting them so the local endpoint is first
            // and the rest are sorted alphabetically
            result = [
                ...result.reduce((acc, stack) => {
                    const endpoint = stack.endpoint || "current";
                    if (!acc.has(endpoint)) {
                        acc.set(endpoint, []);
                    }
                    acc.get(endpoint).push(stack);
                    return acc;
                }, new Map()).entries()
            ].map(([ endpoint, stacks ]) => ({
                endpoint,
                stacks
            })).sort((a, b) => {
                if (a.endpoint === "current" && b.endpoint !== "current") {
                    return -1;
                } else if (a.endpoint !== "current" && b.endpoint === "current") {
                    return 1;
                }
                return a.endpoint.localeCompare(b.endpoint);
            });

            return result;
        },

        isDarkTheme() {
            return document.body.classList.contains("dark");
        },

        stackSearchPlaceholder() {
            return `Suchen (${this.shortcutLabel})`;
        },

        shortcutLabel() {
            const platform = navigator.userAgentData?.platform || navigator.platform || "";
            return /mac|iphone|ipad|ipod/i.test(platform) ? "CMD+K" : "STRG+K";
        },

        projectSearchItems() {
            const stacks = Object.values(this.$root.completeStackList || {});

            return stacks.map((stack, index) => {
                const endpoint = stack.endpoint || "";
                const endpointLabel = endpoint ? this.$root.endpointDisplayFunction(endpoint) || endpoint : this.$t("currentEndpoint");
                const tags = Array.isArray(stack.tags) ? stack.tags : [];
                const tagText = tags
                    .map(tag => `${tag.name || ""} ${tag.value || ""}`)
                    .join(" ");
                const statusLabel = this.$t(statusNameShort(stack.status));

                return {
                    key: `${stack.name}-${endpoint || "current"}-${stack.id ?? index}`,
                    name: stack.name,
                    endpoint,
                    endpointLabel,
                    statusLabel,
                    badgeClass: `bg-${statusColor(stack.status)}`,
                    searchText: `${stack.name} ${endpoint} ${endpointLabel} ${statusLabel} ${tagText}`.toLowerCase(),
                };
            }).sort((a, b) => {
                if (a.endpoint === "" && b.endpoint !== "") {
                    return -1;
                }

                if (a.endpoint !== "" && b.endpoint === "") {
                    return 1;
                }

                return `${a.endpointLabel} ${a.name}`.localeCompare(`${b.endpointLabel} ${b.name}`);
            });
        },

        filteredProjectSearchItems() {
            const query = this.projectSearchQuery.trim().toLowerCase();

            if (!query) {
                return this.projectSearchItems;
            }

            return this.projectSearchItems.filter(item => item.searchText.includes(query));
        },

        projectSearchActiveItemId() {
            return this.filteredProjectSearchItems[this.projectSearchIndex]
                ? this.getProjectSearchItemId(this.filteredProjectSearchItems[this.projectSearchIndex].key)
                : undefined;
        },

        stackListStyle() {
            //let listHeaderHeight = 107;
            let listHeaderHeight = 60;

            if (this.selectMode) {
                listHeaderHeight += 42;
            }

            return {
                "height": `calc(100% - ${listHeaderHeight}px)`
            };
        },

        selectedStackCount() {
            return Object.keys(this.selectedStacks).length;
        },

        /**
         * Determines if any filters are active.
         * @returns {boolean} True if any filter is active, false otherwise.
         */
        filtersActive() {
            return this.filterState.status != null || this.filterState.active != null || this.filterState.tags != null || this.searchText !== "";
        }
    },
    watch: {
        projectSearchQuery() {
            this.projectSearchIndex = 0;
        },
        searchText() {
            for (let stack of this.agentStackList) {
                if (!this.selectedStacks[stack.id]) {
                    if (this.selectAll) {
                        this.disableSelectAllWatcher = true;
                        this.selectAll = false;
                    }
                    break;
                }
            }
        },
        selectAll() {
            if (!this.disableSelectAllWatcher) {
                this.selectedStacks = {};

                if (this.selectAll) {
                    this.agentStackList.forEach((item) => {
                        this.selectedStacks[item.id] = true;
                    });
                }
            } else {
                this.disableSelectAllWatcher = false;
            }
        },
        selectMode() {
            if (!this.selectMode) {
                this.selectAll = false;
                this.selectedStacks = {};
            }
        },
    },
    mounted() {
        window.addEventListener("scroll", this.onScroll);
        window.addEventListener("keydown", this.handleGlobalProjectSearchShortcut, true);
    },
    beforeUnmount() {
        window.removeEventListener("scroll", this.onScroll);
        window.removeEventListener("keydown", this.handleGlobalProjectSearchShortcut, true);
    },
    methods: {
        /**
         * Handle user scroll
         * @returns {void}
         */
        onScroll() {
            if (window.top.scrollY <= 133) {
                this.windowTop = window.top.scrollY;
            } else {
                this.windowTop = 133;
            }
        },

        /**
         * Clear the search bar
         * @returns {void}
         */
        clearSearchText() {
            this.searchText = "";
        },
        openProjectSearchFromInput() {
            this.openProjectSearch(this.searchText);
        },
        handleGlobalProjectSearchShortcut(event) {
            const isProjectSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";

            if (!isProjectSearchShortcut || this.projectSearchItems.length === 0) {
                return;
            }

            event.preventDefault();
            if (this.showProjectSearch) {
                this.$refs.projectSearchInput?.focus();
                this.$refs.projectSearchInput?.select();
                return;
            }

            this.openProjectSearch();
        },
        openProjectSearch(query = "") {
            if (this.projectSearchItems.length === 0) {
                return;
            }

            this.showProjectSearch = true;
            this.projectSearchQuery = query;
            this.projectSearchIndex = 0;

            this.$nextTick(() => {
                this.$refs.projectSearchInput?.focus();
                this.$refs.projectSearchInput?.select();
            });
        },
        closeProjectSearch() {
            this.showProjectSearch = false;
        },
        handleProjectSearchKeydown(event) {
            if (event.key === "ArrowDown") {
                this.moveProjectSearchSelection(1);
                event.preventDefault();
            } else if (event.key === "ArrowUp") {
                this.moveProjectSearchSelection(-1);
                event.preventDefault();
            } else if (event.key === "Enter") {
                const item = this.filteredProjectSearchItems[this.projectSearchIndex];

                if (item) {
                    this.selectProjectSearchItem(item);
                }

                event.preventDefault();
            } else if (event.key === "Escape") {
                this.closeProjectSearch();
                event.preventDefault();
            }
        },
        moveProjectSearchSelection(delta) {
            const itemCount = this.filteredProjectSearchItems.length;

            if (itemCount === 0) {
                this.projectSearchIndex = 0;
                return;
            }

            this.projectSearchIndex = (this.projectSearchIndex + delta + itemCount) % itemCount;
        },
        selectProjectSearchItem(item) {
            const endpointPath = item.endpoint ? `/${encodeURIComponent(item.endpoint)}` : "";

            this.closeProjectSearch();
            this.searchText = "";
            this.$router.push(`/compose/${encodeURIComponent(item.name)}${endpointPath}`);
        },
        getProjectSearchItemId(name) {
            return `project-search-result-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        },
        /**
         * Update the StackList Filter
         * @param {object} newFilter Object with new filter
         * @returns {void}
         */
        updateFilter(newFilter) {
            this.filterState = newFilter;
        },
        /**
         * Deselect a stack
         * @param {number} id ID of stack
         * @returns {void}
         */
        deselect(id) {
            delete this.selectedStacks[id];
        },
        /**
         * Select a stack
         * @param {number} id ID of stack
         * @returns {void}
         */
        select(id) {
            this.selectedStacks[id] = true;
        },
        /**
         * Determine if stack is selected
         * @param {number} id ID of stack
         * @returns {bool} Is the stack selected?
         */
        isSelected(id) {
            return id in this.selectedStacks;
        },
        /**
         * Disable select mode and reset selection
         * @returns {void}
         */
        cancelSelectMode() {
            this.selectMode = false;
            this.selectedStacks = {};
        },
        /**
         * Show dialog to confirm pause
         * @returns {void}
         */
        pauseDialog() {
            this.$refs.confirmPause.show();
        },
        /**
         * Pause each selected stack
         * @returns {void}
         */
        pauseSelected() {
            Object.keys(this.selectedStacks)
                .filter(id => this.$root.stackList[id].active)
                .forEach(id => this.$root.getSocket().emit("pauseStack", id, () => { }));

            this.cancelSelectMode();
        },
        /**
         * Resume each selected stack
         * @returns {void}
         */
        resumeSelected() {
            Object.keys(this.selectedStacks)
                .filter(id => !this.$root.stackList[id].active)
                .forEach(id => this.$root.getSocket().emit("resumeStack", id, () => { }));

            this.cancelSelectMode();
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../styles/vars.scss";

.shadow-box {
    height: calc(100vh - 150px);
    position: sticky;
    top: 10px;
}

.small-padding {
    padding-left: 5px !important;
    padding-right: 5px !important;
}

.list-header {
    border-bottom: 1px solid #dee2e6;
    border-radius: 10px 10px 0 0;
    margin: -10px;
    margin-bottom: 10px;
    padding: 10px;

    .dark & {
        background-color: $dark-header-bg;
        border-bottom: 0;
    }
}

.header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header-filter {
    display: flex;
    align-items: center;
}

@media (max-width: 770px) {
    .list-header {
        margin: -20px;
        margin-bottom: 10px;
        padding: 5px;
    }
}

.search-wrapper {
    display: flex;
    align-items: center;
}

.search-icon {
    padding: 10px;
    color: #c0c0c0;
    cursor: pointer;

    // Clear filter button (X)
    svg[data-icon="times"] {
        cursor: pointer;
        transition: opacity 100ms ease-in-out;

        &:hover {
            opacity: 0.5;
        }
    }
}

.search-input {
    max-width: 15em;
}

.project-search-backdrop {
    align-items: flex-start;
    background: rgba(0, 0, 0, 0.42);
    display: flex;
    inset: 0;
    justify-content: center;
    padding: 92px 16px 24px;
    position: fixed;
    z-index: 3000;
}

.project-search-dialog {
    background: $dark-header-bg;
    border-radius: 20px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.44), 0 0 0 1px rgba(255, 255, 255, 0.08);
    max-height: min(560px, calc(100vh - 124px));
    overflow: hidden;
    width: min(620px, calc(100vw - 32px));
}

.project-search-input-row {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 20px minmax(0, 1fr) 40px;
    padding: 12px;
}

.project-search-icon {
    color: $dark-font-color3;
    justify-self: center;
}

.project-search-input {
    background: $dark-bg2;
    border: 0;
    border-radius: 12px;
    color: $dark-font-color;
    min-height: 44px;
    min-width: 0;
    outline: 0;
    padding: 0 14px;
}

.project-search-input:focus {
    box-shadow: 0 0 0 2px rgba(116, 194, 255, 0.72);
}

.project-search-close {
    align-items: center;
    display: inline-flex;
    justify-content: center;
    min-height: 40px;
    min-width: 40px;
    padding: 0;
}

.project-search-results {
    max-height: min(450px, calc(100vh - 204px));
    overflow-y: auto;
    padding: 0 8px 8px;
}

.project-search-result {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 12px;
    color: $dark-font-color;
    display: flex;
    gap: 16px;
    justify-content: space-between;
    min-height: 58px;
    padding: 10px 12px;
    text-align: left;
    transition: background-color 140ms ease, color 140ms ease, transform 140ms ease;
    width: 100%;
}

.project-search-result.is-active {
    background: rgba(116, 194, 255, 0.14);
    color: #fff;
    transform: translateY(-1px);
}

.project-search-result-name {
    font-weight: 700;
    min-width: 0;
    overflow-wrap: anywhere;
}

.project-search-result-meta {
    align-items: center;
    display: flex;
    flex: 0 1 auto;
    gap: 8px;
    justify-content: flex-end;
    min-width: 0;
}

.project-search-endpoint {
    color: $dark-font-color3;
    font-size: 0.82rem;
    font-weight: 700;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.project-search-empty {
    color: $dark-font-color3;
    padding: 18px 12px 20px;
}

.project-search-fade-enter-active,
.project-search-fade-leave-active {
    transition: opacity 150ms ease;
}

.project-search-fade-enter-from,
.project-search-fade-leave-to {
    opacity: 0;
}

@media (max-width: 520px) {
    .project-search-result {
        align-items: flex-start;
        flex-direction: column;
        gap: 6px;
    }

    .project-search-result-meta {
        justify-content: flex-start;
        width: 100%;
    }
}

.stack-item {
    width: 100%;
}

.tags {
    margin-top: 4px;
    padding-left: 67px;
    display: flex;
    flex-wrap: wrap;
    gap: 0;
}

.bottom-style {
    padding-left: 67px;
    margin-top: 5px;
}

.selection-controls {
    margin-top: 5px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.agent-select {
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: $dark-font-color3;
    padding-left: 10px;
    padding-right: 10px;
    display: flex;
    align-items: center;
    user-select: none;
}
</style>
