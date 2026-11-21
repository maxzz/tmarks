import { type BookmarkId, type BookmarkNodes } from "../store/9-bookmark-types";

// Pure rules for the saved view: which folders are open in the tree, and which folder is selected there.
// No React, Jotai or storage imports here, so the rules can be tested alone.

export interface ViewState {
    /** Folders that are open in the tree. */
    expandedIds: BookmarkId[];
    /** The folder selected in the tree, or `null`. */
    selectedId: BookmarkId | null;
}

/** The value read from storage, checked for shape only. Ids are checked against the tree by `pruneViewState`. */
export function parseViewState(value: unknown): ViewState | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const { expandedIds, selectedId } = value as Record<string, unknown>;
    if (!Array.isArray(expandedIds) || !expandedIds.every((id) => typeof id === "string")) {
        return null;
    }
    if (selectedId !== null && typeof selectedId !== "string") {
        return null;
    }
    return { expandedIds: expandedIds as BookmarkId[], selectedId: selectedId as BookmarkId | null };
}

/**
 * Drops the ids that are no longer in the tree, and duplicates. Only folders can be open or selected in the tree,
 * so an id that names a link is dropped too.
 */
export function pruneViewState(state: ViewState, nodes: BookmarkNodes): ViewState {
    const expandedIds = [...new Set(state.expandedIds)].filter((id) => nodes[id]?.kind === "folder");
    const selectedId = state.selectedId !== null && nodes[state.selectedId]?.kind === "folder" ? state.selectedId : null;
    return { expandedIds, selectedId };
}

/** The view state the tree starts with: the saved one (pruned), or on the first run the top-level folders open. */
export function restoredViewState(saved: ViewState | null, nodes: BookmarkNodes, rootIds: BookmarkId[]): ViewState {
    if (saved) {
        return pruneViewState(saved, nodes);
    }
    return {
        expandedIds: rootIds.filter((id) => nodes[id]?.kind === "folder"),
        selectedId: null,
    };
}
