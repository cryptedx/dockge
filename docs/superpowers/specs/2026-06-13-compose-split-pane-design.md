# Compose Split Pane Design

## Context

Dockge's current compose screen is nested inside the dashboard layout. On wide
screens the dashboard stack list takes a left column, and `Compose.vue` then
splits the remaining page into two equal columns. The YAML editor therefore
gets too little horizontal space for real compose editing.

The selected redesign is "Split Pane Pro": keep Dockge's existing three-area
mental model, but make it adjustable and give the YAML editor a reliable focus
mode.

## Goals

- Make `compose.yaml` editing comfortable on desktop and laptop screens.
- Preserve fast access to stack navigation, service status, `.env`, networks,
  validation, and terminal output.
- Avoid backend changes.
- Keep the design close to Dockge's existing Vue, Bootstrap, and CodeMirror
  structure.
- Make mobile behavior predictable without draggable panes.

## Non-Goals

- Replacing CodeMirror.
- Adding a new compose schema editor.
- Reworking stack data, socket events, or backend deploy behavior.
- Redesigning unrelated pages such as Settings, Console, or Setup.

## Desktop Layout

The desktop compose experience has three panes:

```text
+------------------------------------------------------------------------------+
| Dockge       Home  Console  Settings                         User            |
+--------------+----------------------------------------------+----------------+
| STACKS       | stack-name                     Deploy  Save  | DETAILS        |
| Search...    | compose.yaml                         Focus   | Services       |
|--------------|----------------------------------------------| .env           |
| stack list   | YAML editor                                  | Networks       |
|              |                                              | Validation     |
|              |                                              | Terminal       |
+--------------+----------------------------------------------+----------------+
```

Default pane sizing:

- Stack pane: `260px`
- Details pane: `320px`
- Editor pane: remaining available width

The stack and details panes are resizable with draggable vertical dividers.
Widths are persisted in `localStorage` so a user only has to tune the layout
once. The editor pane always receives the remaining width.

Minimum and maximum widths prevent broken layouts:

- Stack pane minimum: `180px`
- Stack pane maximum: `420px`
- Details pane minimum: `260px`
- Details pane maximum: `520px`
- Editor minimum practical width: `480px`; when the viewport cannot support
  three panes, collapse the secondary panes instead of squeezing the editor.

## Focus Mode

The editor header includes a Focus control. When enabled:

- Stack and details panes collapse.
- The YAML editor uses almost the full content width.
- The action bar remains visible with stack title, `Exit Focus`, `Deploy`, and
  `Save`.
- The previous pane widths are retained and restored when focus mode exits.

```text
+------------------------------------------------------------------------------+
| stack-name                                  Exit Focus  Deploy  Save          |
+------------------------------------------------------------------------------+
| compose.yaml                                                                  |
| +--------------------------------------------------------------------------+ |
| | YAML editor                                                              | |
| +--------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------+
```

Focus mode is local UI state. It must not change route data, compose content,
or stack runtime behavior.

## Details Pane

The details pane holds context that currently competes with the editor:

- Services and container state
- `.env` editor in edit mode
- Networks
- YAML validation errors
- Terminal output

The pane should use compact sections or tabs to avoid becoming a long scroll
trap. The initial version may keep the existing content order if the pane still
stays usable, but the editor must remain the primary working surface.

## Mobile and Narrow Screens

Drag resizing is desktop-only. On narrow screens:

- The layout becomes single-column.
- The stack list is hidden or reached through existing navigation patterns.
- Compose content uses tabs or stacked sections for `YAML`, `Details`, and
  `Terminal`.
- Focus mode is unnecessary on mobile because the editor already occupies the
  main column.

## State and Persistence

Persist only presentation state:

- Stack pane width
- Details pane width
- Optional collapsed state

Do not persist compose content through this feature; existing save and deploy
flows remain the source of truth.

Suggested `localStorage` keys:

- `dockge.composeSplit.stackWidth`
- `dockge.composeSplit.detailsWidth`
- `dockge.composeSplit.detailsCollapsed`

## Error Handling

If stored pane widths are invalid, missing, or outside allowed bounds, clamp
them back to valid defaults. If the viewport is too narrow for stored widths,
prefer preserving editor usability over honoring exact stored widths.

Existing YAML parsing and delayed validation behavior remain unchanged.
Validation messages should stay visible in the details pane and must not block
typing.

## Accessibility

Resizable dividers need keyboard support and accessible labels:

- Each divider has `role="separator"`.
- `aria-orientation="vertical"` is set.
- Keyboard arrow keys adjust the relevant pane width in small increments.
- Focus outlines remain visible.

The Focus control should be a real button with clear text or an accessible
label.

## Acceptance Criteria

- On a wide desktop viewport, the YAML editor is visibly wider than today by
  default.
- Users can resize stack and details panes with the pointer.
- Pane widths survive page reloads.
- Focus mode hides both secondary panes and restores them without data loss.
- Existing deploy, save, start, stop, restart, update, delete, service status,
  `.env`, network, and terminal behavior still works.
- On narrow screens, the editor is not squeezed by desktop split panes.
- Invalid stored layout values do not break the page.
- Basic keyboard resizing works for the pane dividers.

## Implementation Boundaries

Likely touched areas:

- `frontend/src/pages/Dashboard.vue`
- `frontend/src/pages/Compose.vue`
- `frontend/src/components/StackList.vue` if compact stack-pane behavior needs
  minor support
- `frontend/src/styles/main.scss` or scoped compose styles

The design should be implemented as a small frontend-only layout change before
considering deeper component extraction.
