# Global Maintenance Center Design

## Goal

Add a global Maintenance page that scans image updates across every Dockge agent, lets the user select exact services with checkboxes, and applies selected updates globally one queue item at a time.

## Scope

Build the manual workflow only:

- Scan all online agents.
- Show all image-backed services in one global view.
- Let the user select updateable services by service, stack, or agent.
- Run selected updates globally sequentially.
- Keep failures isolated to the failed queue item and continue with the next item.

Do not build scheduling, automatic updates, notifications, image backups, global policy rules, or database persistence in this phase.

## Current Foundation

The `codex/update-panel` branch already has:

- `backend/update-planner.ts` for image reference normalization, registry manifest digest lookup, compose image extraction, and service-name validation.
- `Stack.checkUpdates()` for per-stack update checks.
- `Stack.update(socket, serviceNames)` for per-stack selected-service pull and recreate.
- Agent socket events `checkStackUpdates` and `applyStackUpdates`.
- `frontend/src/pages/Compose.vue` with a stack-local Updates tab.

The Maintenance Center should reuse these units instead of duplicating update detection.

## User Experience

Add a top navigation entry named `Maintenance`.

The page layout is a dense operations table:

- Header summary:
  - agents scanned
  - stacks scanned
  - services checked
  - updates available
  - unknown services
  - failed agents
- Toolbar:
  - `Scan all agents`
  - `Updates only` toggle
  - agent filter
  - search input
- Main table:
  - checkbox
  - agent
  - stack
  - service
  - image
  - status
  - reason
- Selection controls:
  - service checkbox selects one updateable service
  - stack checkbox selects all updateable services in that stack
  - agent checkbox selects all updateable services in that agent
- Batch bar:
  - selected service count
  - affected stacks
  - affected agents
  - `Update selected`

`Current` and `Unknown` rows are visible but not selectable. Only `update-available` rows can be selected.

Before applying updates, show a confirmation modal:

```text
Update 7 services on 3 stacks across 2 agents?
```

## Backend Flow

Add an agent-side socket event:

- `checkAllStackUpdates`
  - runs on one agent instance
  - reads that agent's stack list
  - calls `Stack.checkUpdates()` for each managed stack
  - returns all stack results for that agent

The browser can then call this event through the existing agent proxy for every online agent, including the primary endpoint. This keeps failures isolated and avoids inventing a new cross-agent orchestration layer on the server.

Add an agent-side socket event:

- `applyStackServiceUpdates`
  - validates `stackName`
  - validates `serviceNames` with `isComposeServiceName`
  - calls `Stack.update(socket, serviceNames)`
  - returns success or error

The browser owns the global queue order for this phase. It builds queue items grouped by `{ endpoint, stackName, serviceNames }` and executes them one at a time. This is deliberately simple and visible.

## Data Shapes

Scan response per agent:

```ts
interface AgentUpdateScan {
    endpoint: string;
    name: string;
    ok: boolean;
    error?: string;
    checkedAt?: string;
    stacks: Array<{
        name: string;
        services: StackUpdateService[];
    }>;
}
```

Global queue item:

```ts
interface MaintenanceUpdateJob {
    endpoint: string;
    agentName: string;
    stackName: string;
    serviceNames: string[];
    status: "queued" | "running" | "done" | "failed";
    error?: string;
}
```

## Error Handling

- Offline agents show as failed agent scan rows.
- A failed stack scan does not block other stacks on the same agent.
- A failed update job is marked `failed`; the next queued job still runs.
- The page must never auto-select `Unknown`.
- The page must never start updates without the confirmation modal.

## Testing

Add small assert-based tests for selection grouping and sequential queue execution. Keep UI behavior covered through typecheck/build and focused pure helpers instead of adding a full browser test suite for this phase.

## Acceptance Criteria

- The user can scan all online agents from one page.
- The user can select exact updateable services with checkboxes.
- The user can bulk-select by stack or agent.
- Global updates run strictly one job at a time.
- Failed scans and failed updates are visible and do not stop unrelated work.
- Existing per-stack Updates tab continues to work.
- `pnpm run check-ts`, `pnpm run build:frontend`, and focused helper tests pass.
