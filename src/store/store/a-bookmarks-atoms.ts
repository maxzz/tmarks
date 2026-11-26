import { atom } from "jotai";
import { atomFamily } from "jotai-family";

import { type BookmarkIcons, type BookmarkId, type BookmarkNode, type BookmarkNodes } from "./9-bookmark-types";

export type ViewMode = "list" | "grid";

//---------------------------------------------------------------------------
// Document state: the document of the shown tab. The tabs (see store/tabs) fill these atoms at startup and when
// another tab is shown, and save them after each change.

export const bookmarkNodesAtom = atom<BookmarkNodes>({});
export const bookmarkRootIdsAtom = atom<BookmarkId[]>([]);

/** The icon cache. Links refer to an entry by id, so an icon shared by many bookmarks is kept once. */
export const bookmarkIconsAtom = atom<BookmarkIcons>({});

/** What was loaded this session (imports and the restore at startup), as titled in the console statistics. */
export const loadLogAtom = atom<string[]>([]);

export const hasBookmarksAtom = atom(
    (get) => get(bookmarkRootIdsAtom).length > 0
);

/** Top-level folders, which are the roots of the tree. Top-level links are listed only in the right panel. */
export const rootFolderIdsAtom = atom(
    (get): BookmarkId[] => {
        const nodes = get(bookmarkNodesAtom);
        return get(bookmarkRootIdsAtom).filter((id) => nodes[id]?.kind === "folder");
    }
);

//---------------------------------------------------------------------------
// UI state

// Each panel keeps its own selection. A click in one panel never changes the other panel's selection, so an item
// selected in the right panel stays highlighted whenever its folder is shown there.

/** Tree selection: the folder last clicked (or moved to with the arrows). Only tree actions change it. */
export const treeSelectedIdAtom = atom<BookmarkId | null>(null);
/** Every selected tree row. Plain click selects one; Ctrl/Cmd-click and Shift-click add to it. */
export const treeSelectedIdsAtom = atom<ReadonlySet<BookmarkId>>(new Set<BookmarkId>());

/** Right panel selection: the item last clicked. Only right-panel clicks change it. */
export const itemSelectedIdAtom = atom<BookmarkId | null>(null);
/** Every selected item in the right panel. */
export const itemSelectedIdsAtom = atom<ReadonlySet<BookmarkId>>(new Set<BookmarkId>());

/** The panel the last click came from. Keyboard commands (F2, Delete) act on that panel's selection. */
export const selectionPanelAtom = atom<"tree" | "items">("tree");

/** The active selection: the item the keyboard acts on, and every selected item, from the panel that was clicked last. */
export const selectedIdAtom = atom((get): BookmarkId | null =>
    get(selectionPanelAtom) === "tree" ? get(treeSelectedIdAtom) : get(itemSelectedIdAtom)
);
export const selectedIdsAtom = atom((get): ReadonlySet<BookmarkId> =>
    get(selectionPanelAtom) === "tree" ? get(treeSelectedIdsAtom) : get(itemSelectedIdsAtom)
);

/** Folders that are open in the tree. */
export const expandedIdsAtom = atom<ReadonlySet<BookmarkId>>(new Set<BookmarkId>());
export const viewModeAtom = atom<ViewMode>("list");

/** Id of the item being edited in the F2 dialog, or `null` when the dialog is closed. */
export const editingIdAtom = atom<BookmarkId | null>(null);

/** Form values of the F2 dialog. `isLink` is kept here so the dialog does not change while it animates closed. */
export interface EditDraft {
    isLink: boolean;
    title: string;
    url: string;
}

export const editDraftAtom = atom<EditDraft>({ isLink: false, title: "", url: "" });

// Confirmation dialogs. Each dialog keeps its content in its own atom and tracks open/closed separately,
// so the content does not empty while the dialog animates closed.

/** Top-most selected items waiting for confirmation before they are deleted. */
export const deleteDialogOpenAtom = atom(false);
export const pendingDeleteIdsAtom = atom<BookmarkId[]>([]);

export const clearDialogOpenAtom = atom(false);

//---------------------------------------------------------------------------
// Per-item atoms: a row subscribes only to its own node and flags, so one change re-renders one row

export const nodeAtom = atomFamily(
    (id: BookmarkId) => atom(
        (get): BookmarkNode | undefined => get(bookmarkNodesAtom)[id]
    )
);

export const isExpandedAtom = atomFamily(
    (id: BookmarkId) => atom(
        (get) => get(expandedIdsAtom).has(id)
    )
);

/** Highlight in the right panel: the item is selected there. */
export const isSelectedAtom = atomFamily(
    (id: BookmarkId) => atom(
        (get) => get(itemSelectedIdsAtom).has(id)
    )
);

/** Highlight in the tree: the folder is selected in the tree. */
export const isTreeSelectedAtom = atomFamily(
    (id: BookmarkId) => atom(
        (get) => get(treeSelectedIdsAtom).has(id)
    )
);

/** The icon image of an item: the cached icon for a link, `null` for folders and for links without one. */
export const itemIconAtom = atomFamily(
    (id: BookmarkId) => atom(
        (get): string | null => {
            const node = get(bookmarkNodesAtom)[id];
            if (node?.kind !== "link" || node.iconId === null) {
                return null;
            }
            return get(bookmarkIconsAtom)[node.iconId] ?? null;
        }
    )
);

/** Sub-folders of a folder, in file order. The tree shows only these; links are listed in the right panel. */
export const childFolderIdsAtom = atomFamily(
    (id: BookmarkId) => atom(
        (get): BookmarkId[] => {
            const nodes = get(bookmarkNodesAtom);
            const node = nodes[id];
            return node?.kind === "folder" ? node.childIds.filter((childId) => nodes[childId]?.kind === "folder") : [];
        }
    )
);

//---------------------------------------------------------------------------
// Derived

export const selectedNodeAtom = atom(
    (get): BookmarkNode | undefined => {
        const id = get(selectedIdAtom);
        return id === null ? undefined : get(bookmarkNodesAtom)[id];
    }
);

export const editingNodeAtom = atom(
    (get): BookmarkNode | undefined => {
        const id = get(editingIdAtom);
        return id === null ? undefined : get(bookmarkNodesAtom)[id];
    }
);

/**
 * Folder the right panel stays on after a click inside the right panel. Selecting a folder there only
 * selects it; the panel keeps showing this folder until that folder is opened with a double-click.
 * `null` means no pin: the panel follows the selection. The pinned `id` may be `null`, which shows no folder.
 */
export const pinnedFolderAtom = atom<{ id: BookmarkId | null; } | null>(null);

/**
 * Folder whose items the right panel shows: the pinned folder if there is one, otherwise the selected folder
 * itself or the folder that contains the selected item. `null` means no folder is shown, so the right panel stays
 * empty. That is the case when nothing is selected in the tree. The top level is not shown as a list.
 */
export const currentFolderIdAtom = atom(
    (get): BookmarkId | null => {
        const pinned = get(pinnedFolderAtom);
        if (pinned) {
            const pinnedId = pinned.id;
            if (pinnedId === null || get(bookmarkNodesAtom)[pinnedId]?.kind === "folder") {
                return pinnedId;
            }
        }

        const node = get(selectedNodeAtom);
        if (!node) {
            return null;
        }
        return node.kind === "folder" ? node.id : node.parentId;
    }
);

export const currentFolderNodeAtom = atom(
    (get): BookmarkNode | undefined => {
        const id = get(currentFolderIdAtom);
        return id === null ? undefined : get(bookmarkNodesAtom)[id];
    }
);

export const currentItemIdsAtom = atom(
    (get): BookmarkId[] => {
        const folderId = get(currentFolderIdAtom);
        if (folderId === null) {
            return [];
        }

        const folder = get(bookmarkNodesAtom)[folderId];
        return folder?.kind === "folder" ? folder.childIds : [];
    }
);

/** Folder ids in the order the tree shows them, skipping the children of collapsed folders and all links. */
export const visibleTreeIdsAtom = atom(
    (get): BookmarkId[] => {
        const nodes = get(bookmarkNodesAtom);
        const expanded = get(expandedIdsAtom);
        const out: BookmarkId[] = [];

        function walk(ids: BookmarkId[]) {
            for (const id of ids) {
                const node = nodes[id];
                if (node?.kind !== "folder") {
                    continue;
                }
                out.push(id);
                if (expanded.has(id)) {
                    walk(node.childIds);
                }
            }
        }

        walk(get(bookmarkRootIdsAtom));
        return out;
    }
);
