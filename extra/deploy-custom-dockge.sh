#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_DIR="${SOURCE_DIR:-/opt/dockge-custom}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/dockge}"
BRANCH="${BRANCH:-codex/compose-split-pane}"
IMAGE="${IMAGE:-dockge:compose-split-pane}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml}"
OVERRIDE_FILE="${OVERRIDE_FILE:-compose.custom-image.yaml}"
BUILD_TARGET="${BUILD_TARGET:-release}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/dockge-backups}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-150}"

DRY_RUN=0
SKIP_PULL=0
SKIP_BACKUP=0
SKIP_DOWN=0
FORCE_RESET=0

usage() {
    cat <<'USAGE'
Usage:
  deploy-custom-dockge.sh [options]

Updates a server-side custom Dockge checkout, builds the local image, and
restarts the live Dockge compose project with that image.

Defaults:
  --source-dir     /opt/dockge-custom
  --compose-dir    /opt/dockge
  --branch         codex/compose-split-pane
  --image          dockge:compose-split-pane

Options:
  --source-dir PATH       Git checkout used for docker build
  --compose-dir PATH      Live Dockge compose directory
  --branch NAME           Git branch to pull and build
  --image NAME            Local Docker image tag to build and run
  --compose-file NAME     Main compose file inside compose dir
  --override-file NAME    Generated compose override file
  --backup-root PATH      Backup directory root
  --health-timeout SEC    Seconds to wait for running/healthy container
  --skip-pull             Do not fetch/pull Git changes
  --skip-backup           Do not backup compose.yaml and data/
  --skip-down             Use up -d directly instead of down then up
  --force-reset           Discard local source checkout changes before pull
  --dry-run               Print commands and generated files, change nothing
  -h, --help              Show this help
USAGE
}

log() {
    printf '\n==> %s\n' "$*"
}

die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

quote_command() {
    printf '%q ' "$@"
}

run() {
    if [[ "${DRY_RUN}" == "1" ]]; then
        printf '[dry-run] '
        quote_command "$@"
        printf '\n'
        return 0
    fi

    "$@"
}

write_override_file() {
    local path="${COMPOSE_DIR}/${OVERRIDE_FILE}"

    if [[ "${DRY_RUN}" == "1" ]]; then
        printf '[dry-run] write %s with image %s\n' "${path}" "${IMAGE}"
        return 0
    fi

    cat > "${path}" <<EOF
services:
  dockge:
    image: ${IMAGE}
EOF
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --source-dir)
                SOURCE_DIR="${2:?Missing value for --source-dir}"
                shift 2
                ;;
            --compose-dir)
                COMPOSE_DIR="${2:?Missing value for --compose-dir}"
                shift 2
                ;;
            --branch)
                BRANCH="${2:?Missing value for --branch}"
                shift 2
                ;;
            --image)
                IMAGE="${2:?Missing value for --image}"
                shift 2
                ;;
            --compose-file)
                COMPOSE_FILE="${2:?Missing value for --compose-file}"
                shift 2
                ;;
            --override-file)
                OVERRIDE_FILE="${2:?Missing value for --override-file}"
                shift 2
                ;;
            --backup-root)
                BACKUP_ROOT="${2:?Missing value for --backup-root}"
                shift 2
                ;;
            --health-timeout)
                HEALTH_TIMEOUT_SECONDS="${2:?Missing value for --health-timeout}"
                shift 2
                ;;
            --skip-pull)
                SKIP_PULL=1
                shift
                ;;
            --skip-backup)
                SKIP_BACKUP=1
                shift
                ;;
            --skip-down)
                SKIP_DOWN=1
                shift
                ;;
            --force-reset)
                FORCE_RESET=1
                shift
                ;;
            --dry-run)
                DRY_RUN=1
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                die "Unknown option: $1"
                ;;
        esac
    done
}

preflight() {
    if [[ "${DRY_RUN}" == "1" ]]; then
        log "Dry-run skips server preflight checks"
        return 0
    fi

    require_command git
    require_command docker
    require_command tar

    [[ -d "${SOURCE_DIR}/.git" ]] || die "Not a Git checkout: ${SOURCE_DIR}"
    [[ -f "${SOURCE_DIR}/docker/Dockerfile" ]] || die "Missing Dockerfile: ${SOURCE_DIR}/docker/Dockerfile"
    [[ -d "${COMPOSE_DIR}" ]] || die "Compose directory not found: ${COMPOSE_DIR}"
    [[ -f "${COMPOSE_DIR}/${COMPOSE_FILE}" ]] || die "Compose file not found: ${COMPOSE_DIR}/${COMPOSE_FILE}"
}

ensure_clean_source() {
    if [[ "${DRY_RUN}" == "1" ]]; then
        printf '[dry-run] verify source checkout is clean\n'
        return 0
    fi

    if [[ "${FORCE_RESET}" == "1" ]]; then
        run git -C "${SOURCE_DIR}" reset --hard
        run git -C "${SOURCE_DIR}" clean -fd
        return 0
    fi

    if [[ -n "$(git -C "${SOURCE_DIR}" status --porcelain)" ]]; then
        die "Source checkout has local changes. Commit/stash them or rerun with --force-reset."
    fi
}

update_source() {
    if [[ "${SKIP_PULL}" == "1" ]]; then
        log "Skipping Git pull"
        return 0
    fi

    log "Updating ${SOURCE_DIR} (${BRANCH})"
    run git -C "${SOURCE_DIR}" fetch --prune origin "${BRANCH}"
    run git -C "${SOURCE_DIR}" checkout "${BRANCH}"
    run git -C "${SOURCE_DIR}" pull --ff-only origin "${BRANCH}"
}

backup_live_config() {
    if [[ "${SKIP_BACKUP}" == "1" ]]; then
        log "Skipping backup"
        return 0
    fi

    local stamp
    stamp="$(date +%Y%m%d-%H%M%S)"
    local backup_file="${BACKUP_ROOT}/dockge-${stamp}.tar.gz"

    log "Backing up live Dockge config to ${backup_file}"
    run mkdir -p "${BACKUP_ROOT}"
    run tar -C "${COMPOSE_DIR}" -czf "${backup_file}" "${COMPOSE_FILE}" data
}

build_image() {
    log "Building ${IMAGE}"
    run docker build -t "${IMAGE}" -f "${SOURCE_DIR}/docker/Dockerfile" --target "${BUILD_TARGET}" "${SOURCE_DIR}"
}

compose_cmd() {
    docker compose -f "${COMPOSE_DIR}/${COMPOSE_FILE}" -f "${COMPOSE_DIR}/${OVERRIDE_FILE}" "$@"
}

restart_dockge() {
    log "Writing compose override"
    write_override_file

    if [[ "${SKIP_DOWN}" == "1" ]]; then
        log "Starting Dockge without compose down"
    else
        log "Stopping Dockge"
        run docker compose -f "${COMPOSE_DIR}/${COMPOSE_FILE}" -f "${COMPOSE_DIR}/${OVERRIDE_FILE}" down
    fi

    log "Starting Dockge"
    run docker compose -f "${COMPOSE_DIR}/${COMPOSE_FILE}" -f "${COMPOSE_DIR}/${OVERRIDE_FILE}" up -d --force-recreate
}

wait_for_dockge() {
    if [[ "${DRY_RUN}" == "1" ]]; then
        printf '[dry-run] wait for dockge container to become running or healthy\n'
        return 0
    fi

    log "Waiting for Dockge container"

    local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
    local container_id=""

    while [[ ${SECONDS} -lt ${deadline} ]]; do
        container_id="$(compose_cmd ps -q dockge)"

        if [[ -n "${container_id}" ]]; then
            local state
            local health
            state="$(docker inspect -f '{{.State.Status}}' "${container_id}")"
            health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${container_id}")"

            if [[ "${health}" == "healthy" || ( "${health}" == "none" && "${state}" == "running" ) ]]; then
                log "Dockge is ${state} (${health})"
                compose_cmd ps
                return 0
            fi
        fi

        sleep 3
    done

    compose_cmd ps || true
    compose_cmd logs --tail=80 dockge || true
    die "Dockge did not become running/healthy within ${HEALTH_TIMEOUT_SECONDS}s."
}

main() {
    parse_args "$@"

    log "Deploy settings"
    printf 'SOURCE_DIR=%s\nCOMPOSE_DIR=%s\nBRANCH=%s\nIMAGE=%s\n' "${SOURCE_DIR}" "${COMPOSE_DIR}" "${BRANCH}" "${IMAGE}"

    preflight
    ensure_clean_source
    update_source
    backup_live_config
    build_image
    restart_dockge
    wait_for_dockge

    log "Deploy complete"
}

main "$@"
