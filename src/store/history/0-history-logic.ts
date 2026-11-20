import { type BookmarkId, type BookmarkIcons, type BookmarkNodes } from "@/store/store/9-bookmark-types";

// Pure rules for the undo history. No Jotai or React here, so the rules can be tested alone.

/** How many steps each of the undo and redo stacks keeps. The oldest steps are dropped first. */
export const MAX_HISTORY_STEPS = 100;

export type HistoryCommand = "undo" | "redo";

/** The part of the bookmarks document that undo and redo restore. Selection and expansion are not part of it. */
export interface HistorySnapshot {
    nodes: BookmarkNodes;
    rootIds: BookmarkId[];
    icons: BookmarkIcons;
}

/**
 * True when both snapshots have the same items in the same places. Each node is compared by identity: every change
 * to a node creates a new object, so an unchanged node keeps its identity. Icons are not compared here.
 */
export function isSameTree(a: HistorySnapshot, b: HistorySnapshot): boolean {
    return sameRecord(a.nodes, b.nodes) && sameList(a.rootIds, b.rootIds);
}

/** The icons that at least one link in `nodes` still refers to. Icons nobody refers to are dropped. */
export function pickReferencedIcons(nodes: BookmarkNodes, icons: BookmarkIcons): BookmarkIcons {
    const kept: BookmarkIcons = {};
    for (const node of Object.values(nodes)) {
        if (node.kind === "link" && node.iconId !== null && Object.hasOwn(icons, node.iconId)) {
            kept[node.iconId] = icons[node.iconId];
        }
    }
    return kept;
}

/** Adds a step to the end of a stack and drops the oldest steps beyond `MAX_HISTORY_STEPS`. Returns a new array. */
export function pushStep(stack: HistorySnapshot[], step: HistorySnapshot): HistorySnapshot[] {
    return [...stack, step].slice(-MAX_HISTORY_STEPS);
}

/** The id when it still exists in `nodes`, otherwise `null`. */
export function keepExistingId(id: BookmarkId | null, nodes: BookmarkNodes): BookmarkId | null {
    return id !== null && Object.hasOwn(nodes, id) ? id : null;
}

/** The ids that still exist in `nodes`. Returns `ids` itself when all of them exist, so nothing re-renders for nothing. */
export function keepExistingIds(ids: ReadonlySet<BookmarkId>, nodes: BookmarkNodes): ReadonlySet<BookmarkId> {
    const kept = new Set([...ids].filter((id) => Object.hasOwn(nodes, id)));
    return kept.size === ids.size ? ids : kept;
}

/** Maps a key press to undo or redo: Ctrl+Z (Cmd+Z on macOS) undoes; Ctrl+Y and Ctrl+Shift+Z redo. */
export function historyCommandOf(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): HistoryCommand | null {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return null;
    }
    const key = event.key.toLowerCase();
    if (key === "z") {
        return event.shiftKey ? "redo" : "undo";
    }
    if (key === "y" && !event.shiftKey) {
        return "redo";
    }
    return null;
}

function sameRecord<T>(a: Record<string, T>, b: Record<string, T>): boolean {
    if (a === b) {
        return true;
    }
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) {
        return false;
    }
    return keys.every((key) => Object.hasOwn(b, key) && a[key] === b[key]);
}

function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
    return a === b || (a.length === b.length && a.every((item, index) => item === b[index]));
}
