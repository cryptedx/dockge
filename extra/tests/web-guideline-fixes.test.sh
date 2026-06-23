#!/usr/bin/env bash
set -euo pipefail

assert_contains() {
    local file="$1"
    local pattern="$2"

    if ! grep -Fq "$pattern" "$file"; then
        echo "missing pattern in $file: $pattern" >&2
        exit 1
    fi
}

assert_not_contains() {
    local file="$1"
    local pattern="$2"

    if grep -Fq "$pattern" "$file"; then
        echo "unexpected pattern in $file: $pattern" >&2
        exit 1
    fi
}

assert_contains frontend/src/pages/Compose.vue '<h2 class="mb-0">{{ stack.composeFileName }}</h2>'
assert_contains frontend/src/pages/Compose.vue 'id="stack-name"'
assert_contains frontend/src/pages/Compose.vue 'name="stack-name"'
assert_contains frontend/src/pages/Compose.vue 'autocomplete="off"'
assert_contains frontend/src/pages/Compose.vue 'id="dockge-agent"'
assert_contains frontend/src/pages/Compose.vue 'name="dockge-agent"'
assert_contains frontend/src/pages/Compose.vue 'id="new-container-name"'
assert_contains frontend/src/pages/Compose.vue 'name="new-container-name"'
assert_not_contains frontend/src/pages/Compose.vue 'New Container Name...'

assert_not_contains frontend/src/components/StackList.vue '<a v-if="searchText == '\'''\''" class="search-icon"'
assert_contains frontend/src/components/StackList.vue 'type="button"'
assert_not_contains frontend/src/components/StackList.vue 'aria-label="Compose-Projekte suchen"'
assert_not_contains frontend/src/components/StackList.vue 'aria-label="Suche leeren"'
assert_not_contains frontend/src/components/StackList.vue 'aria-label="Stacks suchen"'
assert_contains frontend/src/components/StackList.vue ':aria-label="$t('\''searchComposeProjects'\'')"'
assert_contains frontend/src/components/StackList.vue ':aria-label="$t('\''clearSearch'\'')"'
assert_contains frontend/src/components/StackList.vue 'name="stack-search"'
assert_contains frontend/src/components/StackList.vue ':aria-label="$t('\''searchStacks'\'')"'
assert_contains frontend/src/components/StackList.vue 'type="button" class="p-2 agent-select"'
assert_contains frontend/src/components/StackList.vue 'name="project-search"'

assert_not_contains frontend/src/components/Container.vue 'aria-label="Statistiken ein-/ausklappen"'
assert_contains frontend/src/components/Container.vue ':aria-label="$t('\''toggleStats'\'')"'
assert_contains frontend/src/components/Container.vue ':for="dockerImageInputId"'
assert_contains frontend/src/components/Container.vue ':id="dockerImageInputId"'
assert_contains frontend/src/components/Container.vue 'name="docker-image"'
assert_contains frontend/src/components/Container.vue ':for="restartPolicyInputId"'
assert_contains frontend/src/components/Container.vue ':id="restartPolicyInputId"'
assert_contains frontend/src/components/Container.vue 'name="restart-policy"'
assert_not_contains frontend/src/components/Container.vue 'replace(/[^a-zA-Z0-9_-]/g, "-")'
assert_contains frontend/src/components/Container.vue 'encodeURIComponent(this.name)'

assert_contains frontend/src/pages/DashboardHome.vue 'for="docker-run-command"'
assert_contains frontend/src/pages/DashboardHome.vue 'id="docker-run-command"'
assert_contains frontend/src/pages/DashboardHome.vue 'name="docker-run-command"'
assert_not_contains frontend/src/pages/DashboardHome.vue 'docker run ...'
assert_not_contains frontend/src/pages/DashboardHome.vue '<font-awesome-icon v-if="agentItem.name !== '\'''\''" icon="pen-to-square" @click='
assert_not_contains frontend/src/pages/DashboardHome.vue '<font-awesome-icon v-if="endpoint !== '\'''\''" class="ms-2 remove-agent" icon="trash" @click='
assert_not_contains frontend/src/pages/DashboardHome.vue 'aria-label="Agentnamen bearbeiten"'
assert_not_contains frontend/src/pages/DashboardHome.vue 'aria-label="Agent entfernen"'
assert_contains frontend/src/pages/DashboardHome.vue ':aria-label="$t('\''editAgentName'\'')"'
assert_contains frontend/src/pages/DashboardHome.vue ':aria-label="$t('\''removeAgent'\'')"'
assert_contains frontend/src/pages/DashboardHome.vue ':for="agentFieldId('\''updated-agent-name'\'', endpoint)"'
assert_contains frontend/src/pages/DashboardHome.vue ':id="agentFieldId('\''updated-agent-name'\'', endpoint)"'
assert_contains frontend/src/pages/DashboardHome.vue 'name="agent-url"'
assert_contains frontend/src/pages/DashboardHome.vue 'name="agent-username"'
assert_contains frontend/src/pages/DashboardHome.vue 'autocomplete="username"'
assert_contains frontend/src/pages/DashboardHome.vue 'spellcheck="false"'
assert_contains frontend/src/pages/DashboardHome.vue 'name="agent-password"'
assert_contains frontend/src/pages/DashboardHome.vue 'name="agent-name"'
assert_not_contains frontend/src/pages/DashboardHome.vue 'transition: all'

assert_not_contains frontend/src/components/Terminal.vue 'this.terminal.focus();'

assert_not_contains frontend/src/mixins/socket.ts 'Reconnecting...'
assert_not_contains frontend/src/mixins/socket.ts 'reconnecting...'

assert_not_contains frontend/src/styles/main.scss 'transition: all'
assert_not_contains frontend/src/styles/main.scss 'outline: none !important'

assert_contains frontend/src/layouts/Layout.vue 'aria-live="polite"'
assert_contains frontend/src/layouts/Layout.vue 'aria-hidden="true"'
assert_contains frontend/src/layouts/Layout.vue '<button class="nav-link" type="button" data-bs-toggle="dropdown"'
assert_not_contains frontend/src/layouts/Layout.vue 'connecting...'
assert_not_contains frontend/src/layouts/Layout.vue 'transition: all'

assert_contains frontend/src/components/TwoFADialog.vue 'aria-describedby="twofa-uri"'
assert_contains frontend/src/components/TwoFADialog.vue 'name="current-password"'
assert_contains frontend/src/components/TwoFADialog.vue 'for="twofa-token"'
assert_contains frontend/src/components/TwoFADialog.vue 'id="twofa-token"'
assert_contains frontend/src/components/TwoFADialog.vue 'name="twofa-token"'
assert_contains frontend/src/components/TwoFADialog.vue 'inputmode="numeric"'
assert_contains frontend/src/components/TwoFADialog.vue 'aria-live="polite"'

assert_contains frontend/src/components/settings/Security.vue 'name="current-password"'
assert_contains frontend/src/components/settings/Security.vue 'name="new-password"'
assert_contains frontend/src/components/settings/Security.vue 'name="repeat-new-password"'
assert_contains frontend/src/components/settings/Security.vue 'name="disable-auth-current-password"'
assert_contains frontend/src/components/settings/Security.vue 'autocomplete="current-password"'
