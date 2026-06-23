export interface PaneConfig {
    name: "stack" | "details";
    storageKey: string;
    defaultWidth: number;
    minWidth: number;
    maxWidth: number;
}

export const STACK_PANE_CONFIG: PaneConfig = {
    name: "stack",
    storageKey: "dockge.composeSplit.stackWidth",
    defaultWidth: 260,
    minWidth: 180,
    maxWidth: 420,
};

export const DETAILS_PANE_CONFIG: PaneConfig = {
    name: "details",
    storageKey: "dockge.composeSplit.detailsWidth",
    defaultWidth: 320,
    minWidth: 260,
    maxWidth: 520,
};

export const EDITOR_MIN_WIDTH = 480;
export const SPLIT_LAYOUT_CHROME_WIDTH = 48;

export function clampPaneWidth(width: number, config: PaneConfig) {
    if (!Number.isFinite(width)) {
        return config.defaultWidth;
    }

    return Math.min(Math.max(Math.round(width), config.minWidth), config.maxWidth);
}

export function readPaneWidth(
    storage: Pick<Storage, "getItem"> | null | undefined,
    config: PaneConfig,
) {
    if (!storage) {
        return config.defaultWidth;
    }

    try {
        const storedValue = storage.getItem(config.storageKey);

        if (storedValue === null || storedValue.trim() === "") {
            return config.defaultWidth;
        }

        return clampPaneWidth(Number(storedValue), config);
    } catch {
        return config.defaultWidth;
    }
}

export function writePaneWidth(
    storage: Pick<Storage, "setItem"> | null | undefined,
    config: PaneConfig,
    width: number,
) {
    const nextWidth = clampPaneWidth(width, config);

    try {
        storage?.setItem(config.storageKey, String(nextWidth));
    } catch {
    }

    return nextWidth;
}

export function shouldCollapseSecondaryPanes(
    viewportWidth: number,
    stackWidth: number,
    detailsWidth: number,
    editorMinWidth = EDITOR_MIN_WIDTH,
    chromeWidth = SPLIT_LAYOUT_CHROME_WIDTH,
) {
    return viewportWidth < stackWidth + detailsWidth + editorMinWidth + chromeWidth;
}
