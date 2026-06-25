export interface ComposeNetworkRow {
    key: string;
    value: Record<string, unknown>;
}

export type ComposeNetworkMap = Record<string, unknown>;

export interface ComposeConfigWithNetworks {
    networks?: ComposeNetworkMap;
}

export function applyComposeNetworks(
    config: ComposeConfigWithNetworks,
    networkList: ComposeNetworkRow[],
    externalList: ComposeNetworkMap,
) {
    const networks: ComposeNetworkMap = {};

    for (const networkRow of networkList) {
        networks[networkRow.key] = networkRow.value;
    }

    for (const networkName in externalList) {
        networks[networkName] = externalList[networkName];
    }

    if (Object.keys(networks).length === 0) {
        delete config.networks;
        return;
    }

    config.networks = networks;
}
