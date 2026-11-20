import { type BookmarkId, type BookmarkNodes } from "./9-bookmark-types";

// Pure selection rules for clicks, in the way Windows File Explorer does it. No React, Jotai or store imports here,
// so the rules can be tested alone (see b-selection-logic.test.ts).

/** One panel's selection: the item the last click landed on (the range anchor), and every selected item. */
export interface SelectionState {
    anchor: BookmarkId | null;
    selected: ReadonlySet<BookmarkId>;
}

export interface ClickModifiers {
    ctrl: boolean;
    shift: boolean;
}

/**
 * The selection after a click on `id`. `order` is the list of the panel's visible items, in on-screen order.
 *
 * - Plain click: selects only `id`.
 * - Ctrl-click: toggles `id` in the selection. `id` becomes the anchor, even when it was just deselected.
 * - Shift-click: selects the range from the anchor to `id`, and the anchor stays where it was.
 * - Ctrl+Shift-click: adds the range to the current selection instead of replacing it.
 *
 * A Shift-click needs an anchor that is in `order`. Without one, it works as a plain click.
 */
export function selectionAfterClick(state: SelectionState, order: readonly BookmarkId[], id: BookmarkId, click: ClickModifiers): SelectionState {
    const from = state.anchor === null ? -1 : order.indexOf(state.anchor);
    const to = order.indexOf(id);

    if (click.shift && from >= 0 && to >= 0) {
        const [start, end] = from < to ? [from, to] : [to, from];
        const range = order.slice(start, end + 1);
        const base = click.ctrl ? state.selected : new Set<BookmarkId>();
        return { anchor: state.anchor, selected: new Set([...base, ...range]) };
    }

    if (click.ctrl) {
        const next = new Set(state.selected);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        return { anchor: id, selected: next };
    }

    return { anchor: id, selected: new Set([id]) };
}

/**
 * The ids that are not inside another id of the same list. Deleting or exporting these covers everything,
 * because a folder carries its contents with it. Ids that are not in `nodes` are dropped.
 */
export function topmostIds(nodes: BookmarkNodes, ids: ReadonlySet<BookmarkId>): BookmarkId[] {
    return [...ids].filter((id) => {
        if (!nodes[id]) {
            return false;
        }
        let parentId = nodes[id].parentId;
        while (parentId !== null) {
            if (ids.has(parentId)) {
                return false;
            }
            parentId = nodes[parentId]?.parentId ?? null;
        }
        return true;
    });
}
