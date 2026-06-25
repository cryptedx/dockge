export type UpdateState = "current" | "update-available" | "unknown";

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

const MANIFEST_ACCEPT = [
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
].join(", ");

function hasRegistry(part: string) {
    return part === "localhost" || part.includes(".") || part.includes(":");
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

async function requestManifest(ref: NormalizedImageReference, fetcher: RegistryFetch, token?: string) {
    const headers: Record<string, string> = {
        Accept: MANIFEST_ACCEPT,
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return fetcher(ref.manifestUrl, { headers });
}

export async function fetchManifestDigest(ref: NormalizedImageReference, fetcher: RegistryFetch = defaultFetch): Promise<string | undefined> {
    let response = await requestManifest(ref, fetcher);

    if (response.status === 401) {
        const authHeader = response.headers.get("www-authenticate");
        if (!authHeader) {
            throw new Error(`Registry rejected ${ref.original} without an auth challenge`);
        }

        const challenge = parseBearerChallenge(authHeader);
        if (!challenge.realm) {
            throw new Error(`Registry auth challenge for ${ref.original} is missing a realm`);
        }

        const tokenUrl = new URL(challenge.realm);
        if (challenge.service ?? ref.authService) {
            tokenUrl.searchParams.set("service", challenge.service ?? ref.authService as string);
        }
        tokenUrl.searchParams.set("scope", challenge.scope ?? `repository:${ref.repository}:pull`);

        const tokenResponse = await fetcher(tokenUrl.toString());
        if (!tokenResponse.ok) {
            throw new Error(`Failed to get registry token for ${ref.original}: ${await tokenResponse.text()}`);
        }

        const tokenBody = await tokenResponse.json() as { token?: string; access_token?: string };
        const token = tokenBody.token ?? tokenBody.access_token;
        if (!token) {
            throw new Error(`Registry token response for ${ref.original} did not include a token`);
        }

        response = await requestManifest(ref, fetcher, token);
    }

    if (!response.ok) {
        throw new Error(`Failed to inspect ${ref.original}: ${await response.text()}`);
    }

    return response.headers.get("docker-content-digest") ?? undefined;
}
