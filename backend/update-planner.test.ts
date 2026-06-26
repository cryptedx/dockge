import assert from "node:assert/strict";
import {
    categorizeUpdateReason,
    compareDigests,
    extractComposeImages,
    fetchManifestDigest,
    fetchManifestInfo,
    getImageRegistryUrl,
    getRollbackImage,
    isComposeServiceName,
    normalizeImageReference,
    parseRepoDigests,
    summarizePreflight,
    updatePinnedComposeImageDigests,
} from "./update-planner";

const dockerHub = normalizeImageReference("nginx:latest");
assert.deepEqual(dockerHub, {
    original: "nginx:latest",
    registry: "registry-1.docker.io",
    repository: "library/nginx",
    tag: "latest",
    manifestUrl: "https://registry-1.docker.io/v2/library/nginx/manifests/latest",
    authService: "registry.docker.io",
});

const ghcr = normalizeImageReference("ghcr.io/example/app:1.2.3");
assert.deepEqual(ghcr, {
    original: "ghcr.io/example/app:1.2.3",
    registry: "ghcr.io",
    repository: "example/app",
    tag: "1.2.3",
    manifestUrl: "https://ghcr.io/v2/example/app/manifests/1.2.3",
    authService: undefined,
});
assert.equal(getImageRegistryUrl("nginx:latest"), "https://hub.docker.com/_/nginx/tags");
assert.equal(getImageRegistryUrl("louislam/dockge:latest"), "https://hub.docker.com/r/louislam/dockge/tags");
assert.equal(getImageRegistryUrl("ghcr.io/example/app:1.2.3"), "https://github.com/example/app/pkgs/container/app");
assert.equal(getRollbackImage("nginx:latest", [ "sha256:old" ]), "nginx:latest@sha256:old");
assert.equal(getRollbackImage("nginx:latest", []), undefined);
assert.equal(categorizeUpdateReason("No local repo digest found"), "no-local-digest");
assert.equal(categorizeUpdateReason("No remote registry digest found"), "no-remote-digest");
assert.equal(categorizeUpdateReason("Timed out checking nginx:latest after 15000ms"), "registry-timeout");
assert.equal(categorizeUpdateReason("Registry rejected nginx:latest without an auth challenge"), "registry-auth");
assert.equal(categorizeUpdateReason("docker compose config failed"), "compose-config-error");
assert.deepEqual(summarizePreflight([
    {
        name: "Compose config",
        status: "ok",
        message: "parsed",
    },
]), {
    status: "ok",
    checks: [
        {
            name: "Compose config",
            status: "ok",
            message: "parsed",
        },
    ],
});
assert.equal(summarizePreflight([
    {
        name: "Disk space",
        status: "warning",
        message: "low",
    },
]).status, "warning");
assert.equal(summarizePreflight([
    {
        name: "Compose config",
        status: "failed",
        message: "invalid",
    },
]).status, "failed");

const manifestInfoCalls: string[] = [];
const manifestInfo = await fetchManifestInfo(ghcr, async (url) => {
    manifestInfoCalls.push(url);

    if (url.endsWith("/manifests/1.2.3")) {
        return {
            ok: true,
            status: 200,
            headers: {
                get(name: string) {
                    return name.toLowerCase() === "docker-content-digest" ? "sha256:remote" : null;
                },
            },
            async json() {
                return {
                    schemaVersion: 2,
                    config: {
                        digest: "sha256:config",
                    },
                };
            },
            async text() {
                return "";
            },
        };
    }

    return {
        ok: true,
        status: 200,
        headers: {
            get() {
                return null;
            },
        },
        async json() {
            return {
                created: "2026-06-24T12:00:00Z",
            };
        },
        async text() {
            return "";
        },
    };
});

assert.deepEqual(manifestInfo, {
    digest: "sha256:remote",
    createdAt: "2026-06-24T12:00:00Z",
});
assert.deepEqual(manifestInfoCalls, [
    "https://ghcr.io/v2/example/app/manifests/1.2.3",
    "https://ghcr.io/v2/example/app/blobs/sha256:config",
]);

assert.deepEqual(parseRepoDigests([
    "nginx@sha256:old",
    "registry-1.docker.io/library/nginx@sha256:current",
]), [ "sha256:old", "sha256:current" ]);

assert.equal(compareDigests([ "sha256:current" ], "sha256:current"), "current");
assert.equal(compareDigests([ "sha256:old" ], "sha256:current"), "update-available");
assert.equal(compareDigests([], "sha256:current"), "unknown");
assert.equal(isComposeServiceName("web-api_1"), true);
assert.equal(isComposeServiceName("--project-directory"), false);
assert.deepEqual(extractComposeImages({
    services: {
        web: {
            image: "nginx:latest",
        },
        worker: {
            build: ".",
        },
        db: {
            image: "postgres:16",
        },
    },
}), [
    {
        service: "web",
        image: "nginx:latest",
    },
    {
        service: "db",
        image: "postgres:16",
    },
]);

const calls: Array<{ url: string; authorization?: string }> = [];
const digest = await fetchManifestDigest(dockerHub, async (url, init) => {
    calls.push({
        url,
        authorization: init?.headers?.Authorization,
    });

    if (calls.length === 1) {
        return {
            ok: false,
            status: 401,
            headers: {
                get(name: string) {
                    return name.toLowerCase() === "www-authenticate"
                        ? "Bearer realm=\"https://auth.docker.io/token\",service=\"registry.docker.io\",scope=\"repository:library/nginx:pull\""
                        : null;
                },
            },
            async json() {
                return {};
            },
            async text() {
                return "unauthorized";
            },
        };
    }

    if (url.startsWith("https://auth.docker.io/token")) {
        return {
            ok: true,
            status: 200,
            headers: {
                get() {
                    return null;
                },
            },
            async json() {
                return { token: "registry-token" };
            },
            async text() {
                return "";
            },
        };
    }

    return {
        ok: true,
        status: 200,
        headers: {
            get(name: string) {
                return name.toLowerCase() === "docker-content-digest" ? "sha256:remote" : null;
            },
        },
        async json() {
            return {};
        },
        async text() {
            return "";
        },
    };
});

assert.equal(digest, "sha256:remote");
assert.equal(calls[2].authorization, "Bearer registry-token");

const composeWithPinnedDigest = `
services:
  redis:
    image: valkey/valkey:9@sha256:old
  web:
    image: nginx:latest
`;
assert.match(updatePinnedComposeImageDigests(composeWithPinnedDigest, [
    {
        service: "redis",
        image: "docker.io/valkey/valkey:9@sha256:old",
        remoteDigest: "sha256:new",
    },
]), /image: valkey\/valkey:9@sha256:new/);
assert.equal(updatePinnedComposeImageDigests(composeWithPinnedDigest, [
    {
        service: "web",
        image: "nginx:latest",
        remoteDigest: "sha256:new",
    },
]), composeWithPinnedDigest);

await assert.rejects(
    () => fetchManifestDigest(normalizeImageReference("ghcr.io/example/slow:latest"), () => new Promise(() => {}), 1),
    /Timed out checking ghcr\.io\/example\/slow:latest after 1ms/
);
