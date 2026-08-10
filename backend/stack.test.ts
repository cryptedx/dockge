import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./stack.ts", import.meta.url), "utf-8");

assert.match(
    source,
    /this\.getComposeOptions\("up", "-d", "--remove-orphans", "--wait", "--wait-timeout", "60", \.\.\.serviceNames\)/
);
