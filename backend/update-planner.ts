import yaml from "yaml";

export type UpdateState = "current" | "update-available" | "unknown";
export type UpdateReasonCode = "no-local-digest" | "no-remote-digest" | "registry-auth" | "registry-timeout" | "registry-error" | "compose-config-error";
export type UpdatePreflightStatus = "ok" | "warning" | "failed";

export interface NormalizedImageReference {
    original: string;
    registry: string;
    repository: string;
    tag: string;
    manifestUrl: string;
    authService?: string;
}

export interface ComposeImage {
    service: string;
    image: string;
}

interface RegistryResponse {
    ok: boolean;
    status: number;
    headers: {
        get(name: string): string | null;
    };
    json(): Promise<unknown>;
    text(): Promise<string>;
}

export type RegistryFetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<RegistryResponse>;

export interface ManifestInfo {
    digest?: string;
    createdAt?: string;
}

export interface UpdatePreflightCheck {
    name: string;
    status: UpdatePreflightStatus;
    message: string;
}

export interface UpdatePreflightSummary {
    status: UpdatePreflightStatus;
    checks: UpdatePreflightCheck[];
}

const REGISTRY_FETCH_TIMEOUT_MS = 15_000;
const MANIFEST_ACCEPT = [
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
].join(", ");

function hasRegistry(part: string) {
    return part === "localhost" || part.includes(".") || part.includes(":");
}

function imageWithDigest(image: string, digest: string) {
    return `${image.split("@")[0]}@${digest}`;
}

export function normalizeImageReference(image: string): NormalizedImageReference {
    const original = image;
    const imageWithoutDigest = image.split("@")[0];
    const lastSlash = imageWithoutDigest.lastIndexOf("/");
    const lastColon = imageWithoutDigest.lastIndexOf(":");
    const hasTag = lastColon > lastSlash;
    const tag = hasTag ? imageWithoutDigest.slice(lastColon + 1) : "latest";
    const imageName = hasTag ? imageWithoutDigest.slice(0, lastColon) : imageWithoutDigest;
    const parts = imageName.split("/");
    let registry = "registry-1.docker.io";
    let repository = imageName;
    let authService: string | undefined = "registry.docker.io";

    if (parts.length > 1 && hasRegistry(parts[0])) {
        registry = parts.shift() as string;
        repository = parts.join("/");
        authService = undefined;
    } else if (!repository.includes("/")) {
        repository = `library/${repository}`;
    }

    if (registry === "docker.io" || registry === "index.docker.io") {
        registry = "registry-1.docker.io";
        authService = "registry.docker.io";
    }

    return {
        original,
        registry,
        repository,
        tag,
        manifestUrl: `https://${registry}/v2/${repository}/manifests/${encodeURIComponent(tag)}`,
        authService,
    };
}

export function getImageRegistryUrl(image: string) {
    const ref = normalizeImageReference(image);
    if (ref.registry === "registry-1.docker.io") {
        if (ref.repository.startsWith("library/")) {
            return `https://hub.docker.com/_/${ref.repository.slice("library/".length)}/tags`;
        }
        return `https://hub.docker.com/r/${ref.repository}/tags`;
    }

    if (ref.registry === "ghcr.io") {
        const [ owner, repo, ...packageParts ] = ref.repository.split("/");
        if (owner && repo) {
            const packageName = packageParts.at(-1) ?? repo;
            return `https://github.com/${owner}/${repo}/pkgs/container/${encodeURIComponent(packageName)}`;
        }
    }

    return undefined;
}

export function getRollbackImage(image: string, localDigests: string[]) {
    const digest = localDigests[0];
    return digest ? imageWithDigest(image, digest) : undefined;
}

export function getUnknownUpdateReason(localDigests: string[], remoteDigest?: string) {
    if (localDigests.length === 0) {
        return "No local repo digest found";
    }
    if (!remoteDigest) {
        return "No remote registry digest found";
    }
    return undefined;
}

export function categorizeUpdateReason(reason: string): UpdateReasonCode {
    const lower = reason.toLowerCase();
    if (lower.includes("local repo digest")) {
        return "no-local-digest";
    }
    if (lower.includes("remote registry digest") || lower.includes("content-digest")) {
        return "no-remote-digest";
    }
    if (lower.includes("timed out") || lower.includes("timeout")) {
        return "registry-timeout";
    }
    if (lower.includes("auth") || lower.includes("unauthorized") || lower.includes("401") || lower.includes("403")) {
        return "registry-auth";
    }
    if (lower.includes("compose") || lower.includes("config")) {
        return "compose-config-error";
    }
    return "registry-error";
}

export function summarizePreflight(checks: UpdatePreflightCheck[]): UpdatePreflightSummary {
    if (checks.some((check) => check.status === "failed")) {
        return {
            status: "failed",
            checks,
        };
    }
    if (checks.some((check) => check.status === "warning")) {
        return {
            status: "warning",
            checks,
        };
    }
    return {
        status: "ok",
        checks,
    };
}

function imageTargetMatches(leftImage: string, rightImage: string) {
    const left = normalizeImageReference(leftImage);
    const right = normalizeImageReference(rightImage);
    return left.registry === right.registry && left.repository === right.repository && left.tag === right.tag;
}

export function updatePinnedComposeImageDigests(composeYAML: string, updates: Array<ComposeImage & { remoteDigest?: string }>) {
    const doc = yaml.parseDocument(composeYAML);
    let changed = false;

    for (const update of updates) {
        if (!update.remoteDigest) {
            continue;
        }

        const currentImage = doc.getIn([ "services", update.service, "image" ]);
        if (typeof currentImage !== "string" || !currentImage.includes("@") || !imageTargetMatches(currentImage, update.image)) {
            continue;
        }

        const nextImage = imageWithDigest(currentImage, update.remoteDigest);
        if (nextImage === currentImage) {
            continue;
        }

        doc.setIn([ "services", update.service, "image" ], nextImage);
        changed = true;
    }

    return changed ? doc.toString() : composeYAML;
}

export function parseRepoDigests(repoDigests: string[] | undefined): string[] {
    return (repoDigests ?? [])
        .map((repoDigest) => repoDigest.split("@")[1])
        .filter((digest): digest is string => Boolean(digest));
}

export function compareDigests(localDigests: string[], remoteDigest?: string): UpdateState {
    if (!remoteDigest || localDigests.length === 0) {
        return "unknown";
    }
    return localDigests.includes(remoteDigest) ? "current" : "update-available";
}

export function isComposeServiceName(serviceName: string) {
    return /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(serviceName);
}

export function extractComposeImages(config: unknown): ComposeImage[] {
    const services = (config as { services?: Record<string, { image?: unknown }> })?.services;
    if (!services) {
        return [];
    }

    return Object.entries(services)
        .filter((entry): entry is [ string, { image: string } ] => typeof entry[1]?.image === "string" && entry[1].image.length > 0)
        .map(([ service, value ]) => ({
            service,
            image: value.image,
        }));
}

function parseBearerChallenge(header: string) {
    const challenge = header.replace(/^Bearer\s+/i, "");
    const values = new Map<string, string>();
    for (const part of challenge.match(/(\w+)="([^"]+)"/g) ?? []) {
        const [ key, value ] = part.split("=");
        values.set(key, value.slice(1, -1));
    }
    return {
        realm: values.get("realm"),
        service: values.get("service"),
        scope: values.get("scope"),
    };
}

async function defaultFetch(url: string, init?: { headers?: Record<string, string> }) {
    return fetch(url, init) as Promise<RegistryResponse>;
}

async function fetchWithTimeout(fetcher: RegistryFetch, url: string, init: { headers?: Record<string, string> } | undefined, timeoutMs: number, image: string) {
    if (timeoutMs <= 0) {
        return fetcher(url, init);
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
        fetcher(url, init),
        new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error(`Timed out checking ${image} after ${timeoutMs}ms`)), timeoutMs);
        }),
    ]).finally(() => {
        if (timeout) {
            clearTimeout(timeout);
        }
    });
}

async function fetchRegistryToken(ref: NormalizedImageReference, fetcher: RegistryFetch, authHeader: string, timeoutMs: number) {
    const challenge = parseBearerChallenge(authHeader);
    if (!challenge.realm) {
        throw new Error(`Registry auth challenge for ${ref.original} is missing a realm`);
    }

    const tokenUrl = new URL(challenge.realm);
    const service = challenge.service ?? ref.authService;
    if (service) {
        tokenUrl.searchParams.set("service", service);
    }
    tokenUrl.searchParams.set("scope", challenge.scope ?? `repository:${ref.repository}:pull`);

    const tokenResponse = await fetchWithTimeout(fetcher, tokenUrl.toString(), undefined, timeoutMs, ref.original);
    if (!tokenResponse.ok) {
        throw new Error(`Failed to get registry token for ${ref.original}: ${await tokenResponse.text()}`);
    }

    const tokenBody = await tokenResponse.json() as { token?: string; access_token?: string };
    const token = tokenBody.token ?? tokenBody.access_token;
    if (!token) {
        throw new Error(`Registry token response for ${ref.original} did not include a token`);
    }
    return token;
}

async function requestRegistryResource(ref: NormalizedImageReference, fetcher: RegistryFetch, url: string, headers: Record<string, string>, token: string | undefined, timeoutMs: number) {
    const requestHeaders = { ...headers };
    if (token) {
        requestHeaders.Authorization = `Bearer ${token}`;
    }

    let response = await fetchWithTimeout(fetcher, url, { headers: requestHeaders }, timeoutMs, ref.original);
    if (response.status !== 401) {
        return {
            response,
            token,
        };
    }

    const authHeader = response.headers.get("www-authenticate");
    if (!authHeader) {
        throw new Error(`Registry rejected ${ref.original} without an auth challenge`);
    }

    const nextToken = await fetchRegistryToken(ref, fetcher, authHeader, timeoutMs);
    response = await fetchWithTimeout(fetcher, url, {
        headers: {
            ...headers,
            Authorization: `Bearer ${nextToken}`,
        },
    }, timeoutMs, ref.original);

    return {
        response,
        token: nextToken,
    };
}

async function requestManifest(ref: NormalizedImageReference, fetcher: RegistryFetch, token: string | undefined, timeoutMs: number, url = ref.manifestUrl) {
    return requestRegistryResource(ref, fetcher, url, {
        Accept: MANIFEST_ACCEPT,
    }, token, timeoutMs);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function getString(value: unknown, key: string) {
    if (!isRecord(value)) {
        return undefined;
    }
    const item = value[key];
    return typeof item === "string" ? item : undefined;
}

function getConfigDigest(manifest: unknown) {
    if (!isRecord(manifest) || !isRecord(manifest.config)) {
        return undefined;
    }
    return getString(manifest.config, "digest");
}

function dockerArchitecture(arch = process.arch) {
    if (arch === "x64") {
        return "amd64";
    }
    if (arch === "arm") {
        return "arm";
    }
    return arch;
}

function selectPlatformManifestDigest(manifest: unknown) {
    if (!isRecord(manifest) || !Array.isArray(manifest.manifests)) {
        return undefined;
    }

    const expectedArch = dockerArchitecture();
    const manifests = manifest.manifests.filter(isRecord);
    const match = manifests.find((item) => {
        const platform = item.platform;
        return isRecord(platform) && platform.os === "linux" && platform.architecture === expectedArch;
    }) ?? manifests.find((item) => typeof item.digest === "string");

    return getString(match, "digest");
}

async function fetchConfigCreatedAt(ref: NormalizedImageReference, fetcher: RegistryFetch, manifest: unknown, token: string | undefined, timeoutMs: number): Promise<string | undefined> {
    let configDigest = getConfigDigest(manifest);
    let activeToken = token;
    const platformManifestDigest = configDigest ? undefined : selectPlatformManifestDigest(manifest);

    if (platformManifestDigest) {
        try {
            const manifestUrl = `https://${ref.registry}/v2/${ref.repository}/manifests/${platformManifestDigest}`;
            const platformManifest = await requestManifest(ref, fetcher, activeToken, timeoutMs, manifestUrl);
            activeToken = platformManifest.token;
            if (!platformManifest.response.ok) {
                return undefined;
            }
            configDigest = getConfigDigest(await platformManifest.response.json());
        } catch {
            return undefined;
        }
    }

    if (!configDigest) {
        return undefined;
    }

    try {
        const configUrl = `https://${ref.registry}/v2/${ref.repository}/blobs/${configDigest}`;
        const config = await requestRegistryResource(ref, fetcher, configUrl, {}, activeToken, timeoutMs);
        if (!config.response.ok) {
            return undefined;
        }
        return getString(await config.response.json(), "created");
    } catch {
        return undefined;
    }
}

export async function fetchManifestInfo(ref: NormalizedImageReference, fetcher: RegistryFetch = defaultFetch, timeoutMs = REGISTRY_FETCH_TIMEOUT_MS): Promise<ManifestInfo> {
    const manifest = await requestManifest(ref, fetcher, undefined, timeoutMs);

    if (!manifest.response.ok) {
        throw new Error(`Failed to inspect ${ref.original}: ${await manifest.response.text()}`);
    }

    const body = await manifest.response.json();
    return {
        digest: manifest.response.headers.get("docker-content-digest") ?? undefined,
        createdAt: await fetchConfigCreatedAt(ref, fetcher, body, manifest.token, timeoutMs),
    };
}

export async function fetchManifestDigest(ref: NormalizedImageReference, fetcher: RegistryFetch = defaultFetch, timeoutMs = REGISTRY_FETCH_TIMEOUT_MS): Promise<string | undefined> {
    const manifest = await requestManifest(ref, fetcher, undefined, timeoutMs);

    if (!manifest.response.ok) {
        throw new Error(`Failed to inspect ${ref.original}: ${await manifest.response.text()}`);
    }

    return manifest.response.headers.get("docker-content-digest") ?? undefined;
}
