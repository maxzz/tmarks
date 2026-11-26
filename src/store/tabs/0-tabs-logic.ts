import { type BookmarkDocument, type BookmarkIcons, type BookmarkId, type BookmarkNode, type BookmarkNodes } from "../store/9-bookmark-types";
import { topmostIds } from "../store/b-selection-logic";
import { type HistoryStacks, keepExistingId, keepExistingIds, pickReferencedIcons, pushStep } from "../history/0-history-logic";
import { restoredViewState, type ViewState } from "../view-state/0-view-state-logic";
import { type DropPlacement } from "@/components/2-main/4-dnd/0-dnd-types";
import { type TabView } from "./0-tabs-types";

// Pure rules for tabs and for moving items between them. No React, Jotai or storage imports here, so the rules can
// be tested alone (see 0-tabs-logic.test.ts).

export const EMPTY_DOCUMENT: BookmarkDocument = { nodes: {}, rootIds: [], icons: {} };

export const EMPTY_HISTORY: HistoryStacks = { undo: [], redo: [] };

export const NEW_TAB_TITLE = "Untitled";

//---------------------------------------------------------------------------
// Views

/** The view of a tab that was just opened: the top-level folders are open, and a sole top-level folder is selected. */
export function initialViewOf(doc: BookmarkDocument): TabView {
    const folders = doc.rootIds.filter((id) => doc.nodes[id]?.kind === "folder");
    const sole = doc.rootIds.length === 1 && folders.length === 1 ? folders[0] : null;
    return viewOfSaved({ expandedIds: folders, selectedId: sole });
}

/** The view of a tab restored after a reload, from what was saved (see view-state/). Checked against the tree. */
export function restoredViewOf(saved: ViewState | null, doc: BookmarkDocument): TabView {
    return viewOfSaved(restoredViewState(saved, doc.nodes, doc.rootIds));
}

/** The part of a view that is kept across reloads. */
export function savedViewOf(view: Pick<TabView, "expandedIds" | "treeSelectedId">): ViewState {
    return { expandedIds: [...view.expandedIds], selectedId: view.treeSelectedId };
}

function viewOfSaved(saved: ViewState): TabView {
    return {
        expandedIds: new Set(saved.expandedIds),
        treeSelectedId: saved.selectedId,
        treeSelectedIds: new Set(saved.selectedId === null ? [] : [saved.selectedId]),
        itemSelectedId: null,
        itemSelectedIds: new Set(),
        selectionPanel: "tree",
        pinnedFolder: null,
    };
}

/** Drops the selected ids that are no longer in `nodes`. Returns `view` itself when nothing was dropped. */
export function pruneView(view: TabView, nodes: BookmarkNodes): TabView {
    const next: TabView = {
        ...view,
        treeSelectedId: keepExistingId(view.treeSelectedId, nodes),
        treeSelectedIds: keepExistingIds(view.treeSelectedIds, nodes),
        itemSelectedId: keepExistingId(view.itemSelectedId, nodes),
        itemSelectedIds: keepExistingIds(view.itemSelectedIds, nodes),
    };
    const same = next.treeSelectedId === view.treeSelectedId && next.treeSelectedIds === view.treeSelectedIds
        && next.itemSelectedId === view.itemSelectedId && next.itemSelectedIds === view.itemSelectedIds;
    return same ? view : next;
}

/**
 * The folder whose items the right panel of a hidden tab would show. The same rule as `currentFolderIdAtom`:
 * the pinned folder, otherwise the selected folder or the folder of the selected item.
 */
export function shownFolderIdOf(view: TabView, nodes: BookmarkNodes): BookmarkId | null {
    if (view.pinnedFolder) {
        const pinnedId = view.pinnedFolder.id;
        if (pinnedId === null || nodes[pinnedId]?.kind === "folder") {
            return pinnedId;
        }
    }
    const selectedId = view.selectionPanel === "tree" ? view.treeSelectedId : view.itemSelectedId;
    const node = selectedId === null ? undefined : nodes[selectedId];
    if (!node) {
        return null;
    }
    return node.kind === "folder" ? node.id : node.parentId;
}

//---------------------------------------------------------------------------
// History of hidden tabs

/** Records a change made to a hidden tab, the way the history module records changes to the shown one. */
export function pushHistoryStep(history: HistoryStacks, before: BookmarkDocument): HistoryStacks {
    return { undo: pushStep(history.undo, before), redo: [] };
}

//---------------------------------------------------------------------------
// Moving items between tabs

/**
 * Where a drop on a tab's header puts the items: at the end of the folder that tab shows. When it shows no folder,
 * folders go to the top level. Links do not, since the top level shows only folders, so the drop is refused.
 */
export function tabHeaderPlacement(shownFolderId: BookmarkId | null, nodes: BookmarkNodes, movingKinds: BookmarkNode["kind"][]): DropPlacement | null {
    if (shownFolderId !== null && nodes[shownFolderId]?.kind === "folder") {
        return { kind: "end", parentId: shownFolderId };
    }
    return movingKinds.length > 0 && movingKinds.every((kind) => kind === "folder") ? { kind: "end", parentId: null } : null;
}

/** The parent and the position among its children that a placement points at, or `null` when it is not in `doc`. */
export function resolvePlacement(doc: Pick<BookmarkDocument, "nodes" | "rootIds">, placement: DropPlacement): { parentId: BookmarkId | null; index: number; } | null {
    const childCount = (parentId: BookmarkId | null): number | null => {
        if (parentId === null) {
            return doc.rootIds.length;
        }
        const parent = doc.nodes[parentId];
        return parent?.kind === "folder" ? parent.childIds.length : null;
    };

    switch (placement.kind) {
        case "into":
        case "end": {
            const parentId = placement.kind === "into" ? placement.folderId : placement.parentId;
            const count = childCount(parentId);
            return count === null ? null : { parentId, index: count };
        }
        case "before":
        case "after": {
            const anchor = doc.nodes[placement.anchorId];
            if (!anchor) {
                return null;
            }
            const siblings = anchor.parentId === null ? doc.rootIds : childIdsOf(doc.nodes[anchor.parentId]);
            const at = siblings.indexOf(anchor.id);
            if (at < 0) {
                return null;
            }
            return { parentId: anchor.parentId, index: placement.kind === "before" ? at : at + 1 };
        }
    }
}

export interface InsertResult {
    doc: BookmarkDocument;
    /** The ids of the inserted top-level items, in order. */
    newIds: BookmarkId[];
}

/**
 * Inserts a fragment (a document such as `selectionDocument` returns) into `target` at `placement`. Every inserted
 * node gets a new id, so a fragment can be inserted any number of times. With `now` the copies get that date, as a
 * copy does; with `null` they keep their dates, as a move does. Returns `null` when the placement is not in `target`
 * or the fragment is empty.
 */
export function insertFragment(
    target: BookmarkDocument,
    fragment: BookmarkDocument,
    placement: DropPlacement,
    now: number | null,
    newId: () => BookmarkId,
): InsertResult | null {
    const spot = resolvePlacement(target, placement);
    const sources = fragment.rootIds.filter((id) => fragment.nodes[id] !== undefined);
    if (!spot || sources.length === 0) {
        return null;
    }

    const nodes: BookmarkNodes = { ...target.nodes };
    const dates = now === null ? {} : { addDate: now, lastModified: now };

    const clone = (id: BookmarkId, parentId: BookmarkId | null): BookmarkId => {
        const node = fragment.nodes[id];
        const copyId = newId();
        if (node.kind === "link") {
            nodes[copyId] = { ...node, id: copyId, parentId, ...dates };
            return copyId;
        }
        const childIds = node.childIds
            .filter((childId) => fragment.nodes[childId] !== undefined)
            .map((childId) => clone(childId, copyId));
        nodes[copyId] = { ...node, id: copyId, parentId, childIds, isToolbar: false, ...dates };
        return copyId;
    };

    const newIds = sources.map((id) => clone(id, spot.parentId));

    let rootIds = target.rootIds;
    if (spot.parentId === null) {
        rootIds = [...rootIds.slice(0, spot.index), ...newIds, ...rootIds.slice(spot.index)];
    } else {
        const parent = nodes[spot.parentId];
        if (parent.kind === "folder") {
            nodes[parent.id] = { ...parent, childIds: [...parent.childIds.slice(0, spot.index), ...newIds, ...parent.childIds.slice(spot.index)] };
        }
    }

    return { doc: { nodes, rootIds, icons: mergeIcons([target.icons, fragment.icons]) }, newIds };
}

/** Removes items, each with everything inside it, and the icons no other link uses. */
export function removeItems(doc: BookmarkDocument, ids: BookmarkId[]): BookmarkDocument {
    const nodes: BookmarkNodes = { ...doc.nodes };
    let rootIds = doc.rootIds;

    for (const id of topmostIds(doc.nodes, new Set(ids))) {
        const node = nodes[id];
        if (node.parentId === null) {
            rootIds = rootIds.filter((rootId) => rootId !== id);
        } else {
            const parent = nodes[node.parentId];
            if (parent?.kind === "folder") {
                nodes[parent.id] = { ...parent, childIds: parent.childIds.filter((childId) => childId !== id) };
            }
        }
        removeSubtree(nodes, id);
    }

    return { nodes, rootIds, icons: pickReferencedIcons(nodes, doc.icons) };
}

//---------------------------------------------------------------------------
// Icons

/**
 * All icons of several documents, in one cache. Icons are named by their content, so equal ids hold equal images.
 * Returns the only non-empty cache itself when there is just one, so nothing is copied for nothing.
 */
export function mergeIcons(caches: BookmarkIcons[]): BookmarkIcons {
    const filled = caches.filter((icons) => Object.keys(icons).length > 0);
    if (filled.length <= 1) {
        return filled[0] ?? caches[0] ?? {};
    }
    const first = filled[0];
    if (filled.every((icons) => Object.keys(icons).every((id) => Object.hasOwn(first, id)))) {
        return first;
    }
    return Object.assign({}, ...filled) as BookmarkIcons;
}

//---------------------------------------------------------------------------
// Helpers

function childIdsOf(node: BookmarkNode | undefined): BookmarkId[] {
    return node?.kind === "folder" ? node.childIds : [];
}

function removeSubtree(nodes: BookmarkNodes, id: BookmarkId) {
    const node = nodes[id];
    if (node?.kind === "folder") {
        for (const childId of node.childIds) {
            removeSubtree(nodes, childId);
        }
    }
    delete nodes[id];
}
