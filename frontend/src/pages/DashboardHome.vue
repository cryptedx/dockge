<template>
    <transition ref="tableContainer" name="slide-fade" appear>
        <div v-if="$route.name === 'DashboardHome'">
            <h1 class="mb-3">
                {{ $t("home") }}
            </h1>

            <div class="row first-row">
                <!-- Left -->
                <div class="col-md-7">
                    <!-- Stats -->
                    <div class="shadow-box big-padding text-center mb-4">
                        <div class="row">
                            <div class="col">
                                <h3>{{ $t("active") }}</h3>
                                <span class="num active">{{ activeNum }}</span>
                            </div>
                            <div class="col">
                                <h3>{{ $t("exited") }}</h3>
                                <span class="num exited">{{ exitedNum }}</span>
                            </div>
                            <div class="col">
                                <h3>{{ $t("inactive") }}</h3>
                                <span class="num inactive">{{ inactiveNum }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Docker Run -->
                    <h2 class="mb-3">{{ $t("Docker Run") }}</h2>
                    <div class="mb-3">
                        <label for="docker-run-command" class="visually-hidden">{{ $t("Docker Run") }}</label>
                        <textarea
                            id="docker-run-command"
                            v-model="dockerRunCommand"
                            name="docker-run-command"
                            class="form-control docker-run shadow-box"
                            autocomplete="off"
                            spellcheck="false"
                            required
                            placeholder="docker run …"
                        ></textarea>
                    </div>

                    <button class="btn-normal btn mb-4" type="button" @click="convertDockerRun">{{ $t("Convert to Compose") }}</button>
                </div>
                <!-- Right -->
                <div class="col-md-5">
                    <!-- Agent List -->
                    <div class="shadow-box big-padding">
                        <h4 class="mb-3">{{ $tc("dockgeAgent", 2) }} <span class="badge bg-warning" style="font-size: 12px;">beta</span></h4>

                        <div v-for="(agentItem, endpoint) in $root.agentList" :key="endpoint" class="mb-3 agent">
                            <!-- Agent Status -->
                            <template v-if="$root.agentStatusList[endpoint]">
                                <span v-if="$root.agentStatusList[endpoint] === 'online'" class="badge bg-primary me-2">{{ $t("agentOnline") }}</span>
                                <span v-else-if="$root.agentStatusList[endpoint] === 'offline'" class="badge bg-danger me-2">{{ $t("agentOffline") }}</span>
                                <span v-else class="badge bg-secondary me-2">{{ $t($root.agentStatusList[endpoint]) }}</span>
                            </template>

                            <!-- Agent Display Name -->
                            <template v-if="$root.agentStatusList[endpoint]">
                                <span v-if="endpoint === '' && agentItem.name === ''" class="badge bg-secondary me-2">Current</span>
                                <span v-else-if="agentItem.name === ''" :href="agentItem.url" class="me-2">{{ endpoint }}</span>
                                <span v-else :href="agentItem.url" class="me-2">{{ agentItem.name }}</span>
                            </template>

                            <!-- Edit Name  -->
                            <button
                                v-if="agentItem.name !== ''"
                                class="agent-icon-button"
                                type="button"
                                :aria-label="$t('editAgentName')"
                                @click="showEditAgentNameDialog[agentItem.name] = !showEditAgentNameDialog[agentItem.name]"
                            >
                                <font-awesome-icon icon="pen-to-square" />
                            </button>

                            <!-- Edit Dialog -->
                            <BModal v-model="showEditAgentNameDialog[agentItem.name]" :no-close-on-backdrop="true" :close-on-esc="true" :okTitle="$t('Update Name')" okVariant="info" @ok="updateName(agentItem.url, agentItem.updatedName)">
                                <label :for="agentFieldId('updated-agent-name', endpoint)" class="form-label">Current value: {{ $t(agentItem.name) }}</label>
                                <input :id="agentFieldId('updated-agent-name', endpoint)" v-model="agentItem.updatedName" name="updated-agent-name" type="text" class="form-control" autocomplete="off" optional>
                            </BModal>

                            <!-- Remove Button -->
                            <button
                                v-if="endpoint !== ''"
                                class="agent-icon-button ms-2 remove-agent"
                                type="button"
                                :aria-label="$t('removeAgent')"
                                @click="showRemoveAgentDialog[agentItem.url] = !showRemoveAgentDialog[agentItem.url]"
                            >
                                <font-awesome-icon icon="trash" />
                            </button>

                            <!-- Remove Agent Dialog -->
                            <BModal v-model="showRemoveAgentDialog[agentItem.url]" :okTitle="$t('removeAgent')" okVariant="danger" @ok="removeAgent(agentItem.url)">
                                <p>{{ agentItem.url }}</p>
                                {{ $t("removeAgentMsg") }}
                            </BModal>
                        </div>

                        <button v-if="!showAgentForm" class="btn btn-normal" @click="showAgentForm = !showAgentForm">{{ $t("addAgent") }}</button>

                        <!-- Add Agent Form -->
                        <form v-if="showAgentForm" @submit.prevent="addAgent">
                            <div class="mb-3">
                                <label for="url" class="form-label">{{ $t("dockgeURL") }}</label>
                                <input id="url" v-model="agent.url" name="agent-url" type="url" class="form-control" autocomplete="url" required placeholder="http://">
                            </div>

                            <div class="mb-3">
                                <label for="username" class="form-label">{{ $t("Username") }}</label>
                                <input id="username" v-model="agent.username" name="agent-username" type="text" class="form-control" autocomplete="username" spellcheck="false" required>
                            </div>

                            <div class="mb-3">
                                <label for="password" class="form-label">{{ $t("Password") }}</label>
                                <input id="password" v-model="agent.password" name="agent-password" type="password" class="form-control" required autocomplete="new-password">
                            </div>

                            <div class="mb-3">
                                <label for="agent-name-input" class="form-label">{{ $t("Friendly Name") }}</label>
                                <input id="agent-name-input" v-model="agent.name" name="agent-name" type="text" class="form-control" autocomplete="off" optional>
                            </div>

                            <button type="submit" class="btn btn-primary" :disabled="connectingAgent">
                                <template v-if="connectingAgent">{{ $t("connecting") }}</template>
                                <template v-else>{{ $t("connect") }}</template>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </transition>
    <router-view v-slot="{ Component }">
        <component
            :is="Component"
            v-on="{
                'compose-focus-change': ($event) => $emit('compose-focus-change', $event),
                'compose-details-width-change': ($event) => $emit('compose-details-width-change', $event),
            }"
        />
    </router-view>
</template>

<script>
import { statusNameShort } from "../../../common/util-common";
import { BModal } from "bootstrap-vue-next";

export default {
    components: {
        BModal,
    },
    props: {
        calculatedHeight: {
            type: Number,
            default: 0
        }
    },
    emits: [ "compose-focus-change", "compose-details-width-change" ],
    data() {
        return {
            page: 1,
            perPage: 25,
            initialPerPage: 25,
            paginationConfig: {
                hideCount: true,
                chunksNavigation: "scroll",
            },
            importantHeartBeatListLength: 0,
            displayedRecords: [],
            dockerRunCommand: "",
            showAgentForm: false,
            showRemoveAgentDialog: {},
            showEditAgentNameDialog: {},
            connectingAgent: false,
            agent: {
                url: "http://",
                username: "",
                password: "",
                name: "",
                updatedName: "",
            }
        };
    },

    computed: {
        activeNum() {
            return this.getStatusNum("active");
        },
        inactiveNum() {
            return this.getStatusNum("inactive");
        },
        exitedNum() {
            return this.getStatusNum("exited");
        },
    },

    watch: {
        perPage() {
            this.$nextTick(() => {
                this.getImportantHeartbeatListPaged();
            });
        },

        page() {
            this.getImportantHeartbeatListPaged();
        },
    },

    mounted() {
        this.initialPerPage = this.perPage;

        window.addEventListener("resize", this.updatePerPage);
        this.updatePerPage();
    },

    beforeUnmount() {
        window.removeEventListener("resize", this.updatePerPage);
    },

    methods: {

        addAgent() {
            this.connectingAgent = true;
            this.$root.getSocket().emit("addAgent", this.agent, (res) => {
                this.$root.toastRes(res);

                if (res.ok) {
                    this.showAgentForm = false;
                    this.agent = {
                        url: "http://",
                        username: "",
                        password: "",
                    };
                }

                this.connectingAgent = false;
            });
        },

        removeAgent(url) {
            this.$root.getSocket().emit("removeAgent", url, (res) => {
                if (res.ok) {
                    this.$root.toastRes(res);

                    let urlObj = new URL(url);
                    let endpoint = urlObj.host;

                    // Remove the stack list and status list of the removed agent
                    delete this.$root.allAgentStackList[endpoint];
                }
            });
        },

        updateName(url, updatedName) {
            this.$root.getSocket().emit("updateAgent", url, updatedName, (res) => {
                this.$root.toastRes(res);

                if (res.ok) {
                    this.showAgentForm = false;
                    this.agent = {
                        updatedName: "",
                    };
                }
            });
        },

        agentFieldId(prefix, endpoint) {
            return `${prefix}-${String(endpoint || "current").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        },

        getStatusNum(statusName) {
            let num = 0;

            for (let stackName in this.$root.completeStackList) {
                const stack = this.$root.completeStackList[stackName];
                if (statusNameShort(stack.status) === statusName) {
                    num += 1;
                }
            }
            return num;
        },

        convertDockerRun() {
            if (this.dockerRunCommand.trim() === "docker run") {
                throw new Error("Please enter a docker run command");
            }

            // composerize is working in dev, but after "vite build", it is not working
            // So pass to backend to do the conversion
            this.$root.getSocket().emit("composerize", this.dockerRunCommand, (res) => {
                if (res.ok) {
                    this.$root.composeTemplate = res.composeTemplate;
                    this.$router.push("/compose");
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        /**
         * Updates the displayed records when a new important heartbeat arrives.
         * @param {object} heartbeat - The heartbeat object received.
         * @returns {void}
         */
        onNewImportantHeartbeat(heartbeat) {
            if (this.page === 1) {
                this.displayedRecords.unshift(heartbeat);
                if (this.displayedRecords.length > this.perPage) {
                    this.displayedRecords.pop();
                }
                this.importantHeartBeatListLength += 1;
            }
        },

        /**
         * Retrieves the length of the important heartbeat list for all monitors.
         * @returns {void}
         */
        getImportantHeartbeatListLength() {
            this.$root.getSocket().emit("monitorImportantHeartbeatListCount", null, (res) => {
                if (res.ok) {
                    this.importantHeartBeatListLength = res.count;
                    this.getImportantHeartbeatListPaged();
                }
            });
        },

        /**
         * Retrieves the important heartbeat list for the current page.
         * @returns {void}
         */
        getImportantHeartbeatListPaged() {
            const offset = (this.page - 1) * this.perPage;
            this.$root.getSocket().emit("monitorImportantHeartbeatListPaged", null, offset, this.perPage, (res) => {
                if (res.ok) {
                    this.displayedRecords = res.data;
                }
            });
        },

        /**
         * Updates the number of items shown per page based on the available height.
         * @returns {void}
         */
        updatePerPage() {
            const tableContainer = this.$refs.tableContainer;
            const tableContainerHeight = tableContainer.offsetHeight;
            const availableHeight = window.innerHeight - tableContainerHeight;
            const additionalPerPage = Math.floor(availableHeight / 58);

            if (additionalPerPage > 0) {
                this.perPage = Math.max(this.initialPerPage, this.perPage + additionalPerPage);
            } else {
                this.perPage = this.initialPerPage;
            }

        },
    }
};
</script>

<style lang="scss" scoped>
@import "../styles/vars";

.num {
    font-size: 30px;

    font-weight: bold;
    display: block;

    &.active {
        color: $primary;
    }

    &.exited {
        color: $danger;
    }
}

.shadow-box {
    padding: 20px;
}

table {
    font-size: 14px;

    tr {
        transition: background-color ease-in-out 0.2s, color ease-in-out 0.2s;
    }

    @media (max-width: 550px) {
        table-layout: fixed;
        overflow-wrap: break-word;
    }
}

.docker-run {
    border: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 15px;
}

.first-row .shadow-box {

}

.remove-agent {
    cursor: pointer;
    color: rgba(255, 255, 255, 0.3);
}

.agent-icon-button {
    background: transparent;
    border: 0;
    color: inherit;
    line-height: 1;
    padding: 0;
}

.agent {
    a {
        text-decoration: none;
    }
}

</style>
