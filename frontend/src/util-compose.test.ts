import assert from "node:assert/strict";

import { applyComposeNetworks } from "./util-compose";

const configWithoutNetworks: { networks?: Record<string, unknown> } = {
    networks: {},
};

applyComposeNetworks(configWithoutNetworks, [], {});
assert.equal("networks" in configWithoutNetworks, false);

const configWithNetworks: { networks?: Record<string, unknown> } = {};

applyComposeNetworks(configWithNetworks, [
    {
        key: "app",
        value: {},
    },
], {
    proxy: {
        external: true,
    },
});
assert.deepEqual(configWithNetworks.networks, {
    app: {},
    proxy: {
        external: true,
    },
});
