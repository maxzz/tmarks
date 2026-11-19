import { atom, getDefaultStore } from "jotai";
import { atomFamily } from "jotai-family";

import { type BookmarkDocument, type BookmarkIcons, type BookmarkId, type BookmarkNode, type BookmarkNodes } from "./9-bookmark-types";
import { completeLegacyTreeMigration, readStoredBookmarks, writeStoredTree } from "../3-local-storage-items";
import { loadIconCache, saveIconCache } from "../io/icon-cache";
import { logDocumentStats } from "../io/document-stats";

export type ViewMode = "list" | "grid";

//---------------------------------------------------------------------------
// Document state. The tree is restored from localStorage at startup, and the icons from IndexedDB shortly after (see
// the end of this file). Both are saved after each change.

const stored = readStoredBookmarks();

export const bookmarkNodesAtom = atom<BookmarkNodes>(stored.nodes);
export const bookmarkRootIdsAtom = atom<BookmarkId[]>(stored.rootIds);

/** The icon cache. Links refer to an entry by id, so an icon shared by many bookmarks is kept once. */
export const bookmarkIconsAtom = atom<BookmarkIcons>(stored.icons);

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

/** The item the keyboard and the right panel follow: the last one clicked, or the one moved to with the arrows. */
export const selectedIdAtom = atom<BookmarkId | null>(null);

/** Every selected item. Plain click selects one item; Ctrl/Cmd-click and Shift-click add to it. */
export const selectedIdsAtom = atom<ReadonlySet<BookmarkId>>(new Set<BookmarkId>());

/** Folders that are open in the tree. The top-level folders start open. */
export const expandedIdsAtom = atom<ReadonlySet<BookmarkId>>(topLevelFolderIds(stored));
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

/** Imported files waiting for the user to choose between replacing the loaded bookmarks and adding them. */
export interface PendingImportFile {
    name: string;
    doc: BookmarkDocument;
}

export const importDialogOpenAtom = atom(false);
export const pendingImportAtom = atom<PendingImportFile[]>([]);

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

export const isSelectedAtom = atomFamily(
    (id: BookmarkId) => atom(
        (get) => get(selectedIdsAtom).has(id)
    )
);

/** Highlight in the tree: the item is selected. Selecting in either panel keeps the tree's highlight in sync. */
export const isTreeSelectedAtom = atomFamily(
    (id: BookmarkId) => atom(
        (get) => get(selectedIdsAtom).has(id)
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
 * `null` means no pin: the panel follows the selection. The pinned `id` may be `null` for the top level.
 */
export const pinnedFolderAtom = atom<{ id: BookmarkId | null; } | null>(null);

/**
 * Folder whose items the right panel shows: the pinned folder if there is one, otherwise the selected folder
 * itself or the folder that contains the selected item. `null` means the top level.
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
            return get(bookmarkRootIdsAtom);
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

//---------------------------------------------------------------------------
// Persistence: the document is written after every change, from a store subscription (not from React)

const persistedDocumentAtom = atom(
    (get): BookmarkDocument => ({
        nodes: get(bookmarkNodesAtom),
        rootIds: get(bookmarkRootIdsAtom),
        icons: get(bookmarkIconsAtom),
    })
);

getDefaultStore().sub(persistedDocumentAtom, () => {
    const doc = getDefaultStore().get(persistedDocumentAtom);
    // Icons are saved first, and the tree after them, so the stored tree never refers to an icon that is not stored.
    void saveIconCache(doc.icons).then(() => writeStoredTree(doc));
});

/**
 * Loads the icons from IndexedDB after startup. The tree is already shown, and icons appear as they load.
 * Icons of the old format are converted and stored here too.
 */
async function restoreIcons(): Promise<void> {
    try {
        const { icons, saved } = await loadIconCache(getDefaultStore().get(bookmarkIconsAtom));
        getDefaultStore().set(bookmarkIconsAtom, (current) => ({ ...icons, ...current }));

        const doc = getDefaultStore().get(persistedDocumentAtom);
        if (saved) {
            completeLegacyTreeMigration(doc);
        }
        if (doc.rootIds.length > 0) {
            const title = "restored from storage";
            logDocumentStats(title, doc);
            getDefaultStore().set(loadLogAtom, (log) => [...log, title]);
        }
    } catch (e) {
        console.error("Failed to restore icons", e);
    }
}

void restoreIcons();

//---------------------------------------------------------------------------

function topLevelFolderIds(doc: BookmarkDocument): Set<BookmarkId> {
    return new Set(
        doc.rootIds.filter((id) => doc.nodes[id]?.kind === "folder")
    );
}
