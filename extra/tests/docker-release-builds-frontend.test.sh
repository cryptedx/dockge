#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

if grep -Eq '^frontend/?$' .dockerignore; then
    fail ".dockerignore must not exclude frontend; docker/Dockerfile builds frontend-dist from source"
fi

grep -q "pnpm run build:frontend" docker/Dockerfile \
    || fail "docker/Dockerfile must build frontend-dist during the image build"

grep -q "COPY --chown=node:node --from=build /app/frontend-dist /app/frontend-dist" docker/Dockerfile \
    || fail "release image must copy frontend-dist from the build stage"

echo "PASS docker-release-builds-frontend"
