# Post-Update Health Gate Design

## Goal

Do not report a running stack update as successful until Docker Compose confirms that the affected services are running or healthy.

Today `Stack.update()` considers `docker compose up -d` successful as soon as the command exits with code zero. Maintenance then verifies only that the selected services use the target image digest. A service that becomes `unhealthy` or exits during startup can therefore still appear as successfully updated.

## Scope

- Apply the health gate to the shared `Stack.update()` runtime path so it protects both the stack-level Update action and Maintenance updates.
- Use Docker Compose's native `up --wait` behavior.
- Wait at most 60 seconds for services to become running or healthy.
- Allow remote update requests up to 180 seconds so image pulls and the health wait fit within the agent acknowledgement window.
- Keep the existing digest verification after a successful Maintenance update.

## Non-Goals

- Automatic rollback.
- Custom HTTP, TCP, or application-level probes.
- A user-configurable timeout.
- Adding healthchecks to user Compose files.
- Health verification for stopped stacks; those continue to pull the image without starting containers.
- Changing whether the Maintenance queue continues after an individual job fails.

## Architecture

### Runtime update

In `backend/stack.ts`, the running-stack branch of `Stack.update()` will execute:

```text
docker compose up -d --remove-orphans --wait --wait-timeout 60 [SERVICE...]
```

Docker Compose treats a service without a healthcheck as ready when it is running. When a healthcheck exists, Compose waits for it to become healthy. A timeout, unhealthy service, exited service, or other Compose failure produces a non-zero exit code and follows Dockge's existing update error path.

The existing stopped-stack branch remains unchanged: Dockge pulls the selected images and returns without a runtime health decision because no containers are started.

### Agent timeout

`backend/agent-manager.ts` currently gives every proxied request 60 seconds. Only the update events `updateStack`, `applyStackUpdates`, and `applyStackServiceUpdates` will use a 180-second acknowledgement timeout. All other agent events retain the existing 60-second timeout.

This timeout is deliberately not exposed as a setting. It only provides headroom for the existing pull plus the bounded 60-second Compose health wait.

### Maintenance flow

The Maintenance flow remains:

1. Pull and recreate the selected services through `Stack.update()`.
2. Wait for Docker Compose to report running or healthy.
3. Re-run `checkStackUpdates` and require the selected services to report the target digest as `current`.
4. Mark the queue job `done` only after both checks pass.

If the Compose health gate fails, the existing callback returns an error, the job is marked `failed`, terminal output remains available, and the queue continues according to current behavior. Runtime-started updates are not rolled back automatically; the existing rollback image hint remains the recovery aid.

## Compatibility

The two live targets were checked before approving this design:

- `docker-main`: Docker Compose 2.29.7
- Frigate LXC: Docker Compose 2.20.3

Both expose `--wait` and `--wait-timeout` for `docker compose up`.

## Testing

- Extend `backend/agent-manager.test.ts` to prove ordinary events retain 60 seconds and each update event receives 180 seconds.
- Run the existing focused TypeScript tests, TypeScript compilation, ESLint, `git diff --check`, and the Vite production build.
- After implementation, use the repository's standard deployment flow and verify both Dockge instances are healthy and use the same image.
- Exercise one healthy update through Maintenance and confirm the job reaches `done` only after Compose completes the health wait and digest verification.
- Exercise the failure path with a disposable Compose service whose healthcheck fails; confirm the update returns an error and the Maintenance job is not marked `done`.

## Acceptance Criteria

- A running service with no healthcheck succeeds once Compose reports it running.
- A service with a healthcheck succeeds only after it reports healthy.
- A service that remains starting, becomes unhealthy, exits, or fails to start does not produce a successful update result.
- Maintenance still requires the selected services to use the target digest before marking the job done.
- Stopped stacks remain pull-only.
- Remote update requests are not cut off by the normal 60-second proxy timeout.
- No automatic rollback, new setting, dependency, or unrelated UI is introduced.
