import assert from "node:assert/strict";
import {
    compareDigests,
    extractComposeImages,
    fetchManifestDigest,
    isComposeServiceName,
    normalizeImageReference,
    parseRepoDigests,
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
