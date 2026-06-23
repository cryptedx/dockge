<template>
    <div class="shadow-box mb-3" :style="boxStyle">
        <div class="list-header">
            <div class="header-top">
                <div class="placeholder"></div>
                <div class="search-wrapper">
                    <button v-if="searchText == ''" class="search-icon" type="button" :aria-label="$t('searchComposeProjects')" @click="openProjectSearch">
                        <font-awesome-icon icon="search" />
                    </button>
                    <button v-if="searchText != ''" class="search-icon" type="button" :aria-label="$t('clearSearch')" @click="clearSearchText">
                        <font-awesome-icon icon="times" />
                    </button>
                    <form @submit.prevent="openProjectSearchFromInput">
                        <input
                            ref="stackSearchInput"
                            v-model="searchText"
                            class="form-control search-input"
                            name="stack-search"
                            autocomplete="off"
                            :aria-label="$t('searchStacks')"
                            :placeholder="stackSearchPlaceholder"
                            @focus="openProjectSearchFromInput"
                        />
                    </form>
                </div>
            </div>
        </div>
        <div ref="stackList" class="stack-list" :class="{ scrollbar: scrollbar }" :style="stackListStyle">
            <div v-if="agentStackList[0] && agentStackList[0].stacks.length === 0" class="text-center mt-3">
                <router-link to="/compose">{{ $t("addFirstStackMsg") }}</router-link>
            </div>
            <div v-for="(agent, agentIndex) in agentStackList" :key="agentIndex" class="stack-list-inner">
                <button
                    v-if="$root.agentCount > 1" type="button" class="p-2 agent-select"
                    :aria-expanded="!closedAgents.get(agent.endpoint)"
                    @click="closedAgents.set(agent.endpoint, !closedAgents.get(agent.endpoint))"
                >
                    <span class="me-1">
                        <font-awesome-icon v-show="closedAgents.get(agent.endpoint)" icon="chevron-circle-right" />
                        <font-awesome-icon v-show="!closedAgents.get(agent.endpoint)" icon="chevron-circle-down" />
                    </span>
                    <span v-if="agent.endpoint === 'current'">{{ $t("currentEndpoint") }}</span>
                    <span v-else>{{ agent.endpoint }}</span>
                </button>
                <StackListItem
                    v-for="(item, index) in agent.stacks" v-show="$root.agentCount === 1 || !closedAgents.get(agent.endpoint)" :key="index" :stack="item"
                />
            </div>
        </div>
    </div>

    <transition name="project-search-fade">
        <div v-if="showProjectSearch" class="project-search-backdrop" @mousedown.self="closeProjectSearch">
            <div class="project-search-dialog" role="dialog" aria-modal="true" :aria-label="$t('searchComposeProjects')">
                <div class="project-search-input-row">
                    <font-awesome-icon icon="search" class="project-search-icon" />
                    <input
                        ref="projectSearchInput"
                        v-model="projectSearchQuery"
                        class="project-search-input"
                        type="search"
                        name="project-search"
                        :placeholder="$t('searchComposeProjects')"
                        role="combobox"
                        aria-controls="project-search-results"
                        :aria-expanded="showProjectSearch"
                        :aria-activedescendant="projectSearchActiveItemId"
                        autocomplete="off"
                        @keydown="handleProjectSearchKeydown"
                    />
                    <button class="btn btn-normal btn-sm project-search-close" type="button" :aria-label="$t('closeProjectSearch')" @click="closeProjectSearch">
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
                        {{ $t("noComposeProjectsFound") }}
                    </div>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
import StackListItem from "../components/StackListItem.vue";
import { CREATED_FILE, CREATED_STACK, EXITED, RUNNING, UNKNOWN, statusColor, statusNameShort } from "../../../common/util-common";

export default {
    components: {
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
            windowTop: 0,
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

                return searchTextMatch;
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
            return {
                "height": "calc(100% - 60px)"
            };
        }
    },
    watch: {
        projectSearchQuery() {
            this.projectSearchIndex = 0;
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
    background: transparent;
    border: 0;
    color: #c0c0c0;
    cursor: pointer;
    padding: 10px;

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
    background: transparent;
    border: 0;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: $dark-font-color3;
    padding-left: 10px;
    padding-right: 10px;
    display: flex;
    align-items: center;
    text-align: left;
    user-select: none;
    width: 100%;
}
</style>
