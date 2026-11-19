import { atom, getDefaultStore, type Getter, type Setter } from "jotai";
import { notice } from "@/ui/local-ui/7-toaster";
import { uuid } from "@/utils/uuid";
import { downloadTextFile } from "../io/download-text-file";
import { parseNetscapeBookmarks } from "../io/netscape-parse";
import { serializeNetscapeBookmarks } from "../io/netscape-serialize";
import { type BookmarkDocument, type BookmarkId, type BookmarkNode, type BookmarkNodes } from "./9-bookmark-types";
import {
    bookmarkNodesAtom,
    bookmarkRootIdsAtom,
    childFolderIdsAtom,
    clearDialogOpenAtom,
    currentItemIdsAtom,
    deleteDialogOpenAtom,
    editDraftAtom,
    editingIdAtom,
    editingNodeAtom,
    expandedIdsAtom,
    hasBookmarksAtom,
    importDialogOpenAtom,
    pendingDeleteIdsAtom,
    currentFolderIdAtom,
    pendingImportAtom,
    pinnedFolderAtom,
    type PendingImportFile,
    selectedIdAtom,
    selectedIdsAtom,
    selectedNodeAtom,
    visibleTreeIdsAtom,
} from "./a-bookmarks-atoms";

//---------------------------------------------------------------------------
// Loading

/** Replaces the loaded document and resets selection, editing and expansion. The top-level folders start expanded. */
export const loadBookmarkDocumentAtom = atom(
    null,
    (_get, set, doc: BookmarkDocument) => {
        set(bookmarkNodesAtom, doc.nodes);
        set(bookmarkRootIdsAtom, doc.rootIds);
        set(selectedIdAtom, null);
        set(selectedIdsAtom, new Set());
        set(pinnedFolderAtom, null);
        set(editingIdAtom, null);
        set(expandedIdsAtom, new Set(doc.rootIds.filter((id) => doc.nodes[id]?.kind === "folder")));
    }
);

/**
 * Reads one or more dropped or picked files. With nothing loaded they become the content; otherwise the
 * user is asked whether to replace the content or add the files as folders (see the import dialog).
 */
export const importBookmarkFilesAtom = atom(
    null,
    async (get, set, files: File[]) => {
        const candidates = files.filter(isBookmarkHtmlFile);
        if (candidates.length === 0) {
            notice.info("Unsupported file. Please use a bookmarks .html file exported from Chrome or Opera.");
            return;
        }

        const fileList = candidates.map((file) => `"${file.name}"`).join(", ");

        let entries: PendingImportFile[];
        try {
            entries = await Promise.all(candidates.map(async (file) => ({
                name: file.name,
                doc: parseNetscapeBookmarks(await file.text()),
            })));
        } catch (e) {
            console.error("Failed to import bookmarks", e);
            notice.error(`Failed to read ${fileList}.`);
            return;
        }

        const found = entries.filter((entry) => entry.doc.rootIds.length > 0);
        if (found.length === 0) {
            notice.info(`No bookmarks found in ${fileList}.`);
            return;
        }

        if (get(hasBookmarksAtom)) {
            set(pendingImportAtom, found);
            set(importDialogOpenAtom, true);
            return;
        }

        set(loadBookmarkDocumentAtom, mergeBookmarkDocuments(found.map((entry) => entry.doc)));
        notice.success(`Imported ${countLinks(found.flatMap((entry) => Object.values(entry.doc.nodes)))} bookmarks from ${fileList}.`);
    }
);

/** Choice in the import dialog: replace everything with the imported files. */
export const replaceWithImportAtom = atom(
    null,
    (get, set) => {
        const pending = get(pendingImportAtom);
        set(importDialogOpenAtom, false);
        set(loadBookmarkDocumentAtom, mergeBookmarkDocuments(pending.map((entry) => entry.doc)));
        notice.success(`Replaced the bookmarks with ${pending.map((entry) => `"${entry.name}"`).join(", ")}.`);
    }
);

/** Choice in the import dialog: keep what is loaded and add each imported file as a folder at the end. */
export const appendImportAtom = atom(
    null,
    (get, set) => {
        const pending = get(pendingImportAtom);
        const current: BookmarkDocument = { nodes: get(bookmarkNodesAtom), rootIds: get(bookmarkRootIdsAtom) };
        const { doc, folderIds } = appendImportedFolders(current, pending, Math.floor(Date.now() / 1000));

        set(importDialogOpenAtom, false);
        set(bookmarkNodesAtom, doc.nodes);
        set(bookmarkRootIdsAtom, doc.rootIds);

        if (folderIds.length > 0) {
            set(selectItemAtom, folderIds[0]);
        }
        notice.success(`Added ${pending.length === 1 ? "a folder" : `${pending.length} folders`} with the imported bookmarks at the end.`);
    }
);

export const cancelImportAtom = atom(
    null,
    (_get, set) => {
        set(importDialogOpenAtom, false);
    }
);

/** Opens the system file dialog and imports the chosen files, as dropping them would. */
export const openImportPickerAtom = atom(
    null,
    () => {
        const store = getDefaultStore();
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".html,.htm,text/html";
        input.multiple = true;
        input.addEventListener("change", () => {
            void store.set(importBookmarkFilesAtom, Array.from(input.files ?? []));
        });
        input.click();
    }
);

//---------------------------------------------------------------------------
// Saving

export const saveBookmarksAtom = atom(
    null,
    (get) => {
        const rootIds = get(bookmarkRootIdsAtom);
        if (rootIds.length === 0) {
            notice.info("Nothing to save yet. Import a bookmarks file first.");
            return;
        }

        const html = serializeNetscapeBookmarks({ nodes: get(bookmarkNodesAtom), rootIds });
        const stamp = new Date().toISOString().slice(0, 10);
        downloadTextFile(`bookmarks-${stamp}.html`, html, "text/html");
    }
);

//---------------------------------------------------------------------------
// Selection and expansion

/** Selects one item (and expands its ancestors, and the item itself when it is a folder), so it is visible in the tree. */
export const selectItemAtom = atom(
    null,
    (get, set, id: BookmarkId | null) => {
        set(pinnedFolderAtom, null);
        set(selectedIdAtom, id);
        set(selectedIdsAtom, id === null ? new Set() : new Set([id]));
        if (id === null) {
            return;
        }

        const nodes = get(bookmarkNodesAtom);
        const expanded = new Set(get(expandedIdsAtom));
        const node = nodes[id];
        if (node?.kind === "folder") {
            expanded.add(id);
        }

        let parentId = node?.parentId ?? null;
        while (parentId !== null) {
            expanded.add(parentId);
            parentId = nodes[parentId]?.parentId ?? null;
        }

        set(expandedIdsAtom, expanded);
    }
);

/**
 * Click on a tree row (scope "tree") or an item (scope "items"). A plain click selects only that item,
 * Ctrl/Cmd-click toggles it in the selection, and Shift-click selects the range from the last clicked item.
 */
export const clickItemAtom = atom(
    null,
    (get, set, click: { id: BookmarkId; scope: "tree" | "items"; ctrl: boolean; shift: boolean; }) => {
        // Clicks in the right panel keep the panel on its current folder, even when the clicked item is a folder.
        const panelFolderId = get(currentFolderIdAtom);
        selectClickedItem(get, set, click);
        set(pinnedFolderAtom, click.scope === "items" ? { id: panelFolderId } : null);
    }
);

/** Opens a folder: selects it and shows its contents in the right panel (used by double-click). */
export const openFolderAtom = atom(
    null,
    (_get, set, id: BookmarkId) => {
        set(pinnedFolderAtom, null);
        set(selectItemAtom, id);
    }
);

function selectClickedItem(
    get: Getter,
    set: Setter,
    click: { id: BookmarkId; scope: "tree" | "items"; ctrl: boolean; shift: boolean; }
) {
    const anchor = get(selectedIdAtom);

    if (click.shift && anchor !== null) {
        const order = click.scope === "tree" ? get(visibleTreeIdsAtom) : get(currentItemIdsAtom);
        const from = order.indexOf(anchor);
        const to = order.indexOf(click.id);
        if (from >= 0 && to >= 0) {
            const [start, end] = from < to ? [from, to] : [to, from];
            set(selectedIdsAtom, new Set(order.slice(start, end + 1)));
            return;
        }
    }

    if (click.ctrl) {
        const next = new Set(get(selectedIdsAtom));
        if (next.has(click.id)) {
            next.delete(click.id);
        } else {
            next.add(click.id);
        }
        set(selectedIdsAtom, next);
        set(selectedIdAtom, click.id);
        return;
    }

    set(selectItemAtom, click.id);
}

export const toggleExpandedAtom = atom(
    null,
    (get, set, id: BookmarkId) => {
        const expanded = new Set(get(expandedIdsAtom));
        if (expanded.has(id)) {
            expanded.delete(id);
        } else {
            expanded.add(id);
        }
        set(expandedIdsAtom, expanded);
    }
);

/** Arrow-key navigation over the tree: Up/Down move, Right expands or enters, Left collapses or goes to the parent. */
export const navigateTreeKeyAtom = atom(
    null,
    (get, set, key: string) => {
        if (get(editingIdAtom) !== null) {
            return;
        }

        const visible = get(visibleTreeIdsAtom);
        const expanded = get(expandedIdsAtom);
        const selected = get(selectedNodeAtom);
        // A selected link is not in the tree, so the arrows move from the folder that contains it.
        const anchorId = selected?.kind === "link" ? selected.parentId : (selected?.id ?? null);
        const index = anchorId === null ? -1 : visible.indexOf(anchorId);

        const moveBy = (delta: number) => {
            if (visible.length === 0) {
                return;
            }
            const next = index < 0
                ? (delta > 0 ? 0 : visible.length - 1)
                : Math.min(Math.max(index + delta, 0), visible.length - 1);
            set(selectItemAtom, visible[next]);
        };

        switch (key) {
            case "ArrowDown":
                moveBy(1);
                break;
            case "ArrowUp":
                moveBy(-1);
                break;
            case "ArrowRight":
                if (selected?.kind === "folder" && get(childFolderIdsAtom(selected.id)).length > 0) {
                    if (expanded.has(selected.id)) {
                        moveBy(1);
                    } else {
                        set(toggleExpandedAtom, selected.id);
                    }
                }
                break;
            case "ArrowLeft":
                if (selected?.kind === "folder" && expanded.has(selected.id)) {
                    set(toggleExpandedAtom, selected.id);
                } else if (selected?.parentId) {
                    set(selectItemAtom, selected.parentId);
                }
                break;
        }
    }
);

//---------------------------------------------------------------------------
// Editing (F2)

/** Opens the edit dialog for one item, with its current name and URL. The selection does not change. */
export const startEditAtom = atom(
    null,
    (get, set, id: BookmarkId) => {
        const node = get(bookmarkNodesAtom)[id];
        if (!node || get(editingIdAtom) !== null) {
            return;
        }

        set(editDraftAtom, {
            isLink: node.kind === "link",
            title: node.title,
            url: node.kind === "link" ? node.url : "",
        });
        set(editingIdAtom, node.id);
    }
);

/** Opens the edit dialog for the selected item (F2). */
export const startEditSelectedAtom = atom(
    null,
    (get, set) => {
        const id = get(selectedIdAtom);
        if (id !== null) {
            set(startEditAtom, id);
        }
    }
);

export const cancelEditAtom = atom(
    null,
    (_get, set) => {
        set(editingIdAtom, null);
    }
);

/** Saves the draft into the node being edited. Empty name (or empty URL for a bookmark) is rejected. */
export const commitEditAtom = atom(
    null,
    (get, set) => {
        const node = get(editingNodeAtom);
        if (!node) {
            set(editingIdAtom, null);
            return;
        }

        const draft = get(editDraftAtom);
        const title = draft.title.trim();
        const url = draft.url.trim();
        if (!title || (node.kind === "link" && !url)) {
            return;
        }

        const lastModified = Math.floor(Date.now() / 1000);
        const updated: BookmarkNode = node.kind === "link"
            ? { ...node, title, url, lastModified }
            : { ...node, title, lastModified };

        set(bookmarkNodesAtom, { ...get(bookmarkNodesAtom), [node.id]: updated });
        set(editingIdAtom, null);
    }
);

//---------------------------------------------------------------------------
// Deleting (Delete key, or the selection's context)

/**
 * Asks for confirmation before deleting the given items. Deleting a folder deletes everything inside it,
 * so an item that sits inside another given item is left out of the list.
 */
export const requestDeleteAtom = atom(
    null,
    (get, set, items: ReadonlySet<BookmarkId>) => {
        const nodes = get(bookmarkNodesAtom);
        const ids = topmostSelectedIds(nodes, items);
        if (ids.length > 0) {
            set(pendingDeleteIdsAtom, ids);
            set(deleteDialogOpenAtom, true);
        }
    }
);

/** Asks for confirmation before deleting the selected items (Delete key). */
export const requestDeleteSelectedAtom = atom(
    null,
    (get, set) => {
        set(requestDeleteAtom, get(selectedIdsAtom));
    }
);

export const cancelDeleteAtom = atom(
    null,
    (_get, set) => {
        set(deleteDialogOpenAtom, false);
    }
);

export const confirmDeleteAtom = atom(
    null,
    (get, set) => {
        const ids = get(pendingDeleteIdsAtom);
        set(deleteDialogOpenAtom, false);

        const nodes: BookmarkNodes = { ...get(bookmarkNodesAtom) };
        let rootIds = [...get(bookmarkRootIdsAtom)];

        for (const id of ids) {
            const node = nodes[id];
            if (!node) {
                continue;
            }

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

        set(bookmarkNodesAtom, nodes);
        set(bookmarkRootIdsAtom, rootIds);
        set(selectedIdAtom, null);
        set(selectedIdsAtom, new Set());
        set(pinnedFolderAtom, null);
        notice.info(ids.length === 1 ? "Deleted 1 item." : `Deleted ${ids.length} items.`);
    }
);

//---------------------------------------------------------------------------
// Clearing everything

export const requestClearAtom = atom(
    null,
    (_get, set) => {
        set(clearDialogOpenAtom, true);
    }
);

export const cancelClearAtom = atom(
    null,
    (_get, set) => {
        set(clearDialogOpenAtom, false);
    }
);

export const confirmClearAtom = atom(
    null,
    (_get, set) => {
        set(clearDialogOpenAtom, false);
        set(loadBookmarkDocumentAtom, { nodes: {}, rootIds: [] });
        notice.info("All bookmarks were cleared.");
    }
);

//---------------------------------------------------------------------------
// Helpers

function isBookmarkHtmlFile(file: File): boolean {
    return /\.html?$/i.test(file.name) || file.type === "text/html";
}

function mergeBookmarkDocuments(docs: BookmarkDocument[]): BookmarkDocument {
    const nodes: BookmarkNodes = {};
    const rootIds: BookmarkId[] = [];
    for (const doc of docs) {
        Object.assign(nodes, doc.nodes);
        rootIds.push(...doc.rootIds);
    }
    return { nodes, rootIds };
}

/**
 * Adds each imported file as a new top-level folder after the current items. The folder takes the file name,
 * and the file's top-level items move inside it. The "Bookmarks bar" flag is dropped, since the folder is no longer the bar.
 */
function appendImportedFolders(current: BookmarkDocument, files: PendingImportFile[], now: number): { doc: BookmarkDocument; folderIds: BookmarkId[]; } {
    const nodes: BookmarkNodes = { ...current.nodes };
    const rootIds = [...current.rootIds];
    const folderIds: BookmarkId[] = [];

    for (const file of files) {
        const folderId = uuid();
        const childIds: BookmarkId[] = [];
        Object.assign(nodes, file.doc.nodes);

        for (const id of file.doc.rootIds) {
            const node = nodes[id];
            if (!node) {
                continue;
            }
            nodes[id] = node.kind === "folder"
                ? { ...node, parentId: folderId, isToolbar: false }
                : { ...node, parentId: folderId };
            childIds.push(id);
        }

        nodes[folderId] = {
            kind: "folder",
            id: folderId,
            parentId: null,
            title: file.name.replace(/\.html?$/i, "") || "Imported bookmarks",
            addDate: now,
            lastModified: now,
            childIds,
            isToolbar: false,
        };
        rootIds.push(folderId);
        folderIds.push(folderId);
    }

    return { doc: { nodes, rootIds }, folderIds };
}

/** Ids of the selected items that are not inside another selected folder, so each deletion removes its contents once. */
function topmostSelectedIds(nodes: BookmarkNodes, selected: ReadonlySet<BookmarkId>): BookmarkId[] {
    return [...selected].filter((id) => {
        if (!nodes[id]) {
            return false;
        }
        let parentId = nodes[id].parentId;
        while (parentId !== null) {
            if (selected.has(parentId)) {
                return false;
            }
            parentId = nodes[parentId]?.parentId ?? null;
        }
        return true;
    });
}

/** Removes a node and, for folders, everything inside it. Mutates the `nodes` copy passed in. */
function removeSubtree(nodes: BookmarkNodes, id: BookmarkId) {
    const node = nodes[id];
    if (node?.kind === "folder") {
        for (const childId of node.childIds) {
            removeSubtree(nodes, childId);
        }
    }
    delete nodes[id];
}

function countLinks(nodes: BookmarkNode[]): number {
    return nodes.filter((node) => node.kind === "link").length;
}
