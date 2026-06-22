# Dockge Server Deploy Script Design

## Goal

Provide one server-side script for updating the custom Dockge build after code is pushed to GitHub.

## Confirmed Defaults

- Source checkout: `/opt/dockge-custom`
- Live compose directory: `/opt/dockge`
- Branch: `codex/compose-split-pane`
- Built image: `dockge:compose-split-pane`
- Docker target: `release`

## Behavior

The script runs on the server that already has Docker installed. It updates the source checkout, builds the local Docker image, creates a backup of the live Dockge compose directory, stops the current Dockge compose project, and starts it again using the locally built image.

The script must not copy or replace the existing Dockge config. `/opt/dockge` remains the live state directory with the existing `compose.yaml` and `data/`. To avoid rewriting the user's compose file, the script writes `/opt/dockge/compose.custom-image.yaml` with only the custom image override and always uses both compose files.

## Safety

- Fail fast on missing tools or missing directories.
- Abort if the source checkout has local modifications unless `--force-reset` is explicitly passed.
- Create a timestamped backup before restart unless `--skip-backup` is passed.
- Support `--dry-run` so the user can inspect all commands before running them.
- Print container status and recent logs if the container does not become running or healthy.

