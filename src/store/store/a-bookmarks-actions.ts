import { atom, getDefaultStore, type Getter, type Setter } from "jotai";
import { notice } from "@/ui/local-ui/7-toaster";
import { uuid } from "@/utils/uuid";
import { downloadTextFile } from "../io/download-text-file";
import { logDocumentStats } from "../io/document-stats";
import { parseNetscapeBookmarks } from "../io/netscape-parse";
import { serializeNetscapeBookmarks } from "../io/netscape-serialize";
import { exportFileName, selectionDocument } from "../io/selection-export";
import { type BookmarkDocument, type BookmarkIcons, type BookmarkId, type BookmarkNode, type BookmarkNodes } from "./9-bookmark-types";
import { selectionAfterClick, topmostIds } from "./b-selection-logic";
import {
    bookmarkIconsAtom,
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
    loadLogAtom,
    pendingDeleteIdsAtom,
    currentFolderIdAtom,
    pendingImportAtom,
    pinnedFolderAtom,
    type PendingImportFile,
    itemSelectedIdAtom,
    itemSelectedIdsAtom,
    selectedIdAtom,
    selectedIdsAtom,
    selectionPanelAtom,
    treeSelectedIdAtom,
    treeSelectedIdsAtom,
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
        set(bookmarkIconsAtom, doc.icons);
        clearAllSelection(set);
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
            entries = await Promise.all(candidates.map(async (file) => {
                const html = await file.text();
                const started = performance.now();
                const doc = parseNetscapeBookmarks(html);
                const title = `imported "${file.name}" (parsed in ${(performance.now() - started).toFixed(1)} ms)`;
                logDocumentStats(title, doc);
                set(loadLogAtom, (log) => [...log, title]);
                return { name: file.name, doc };
            }));
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
        const current: BookmarkDocument = { nodes: get(bookmarkNodesAtom), rootIds: get(bookmarkRootIdsAtom), icons: get(bookmarkIconsAtom) };
        const { doc, folderIds } = appendImportedFolders(current, pending, Math.floor(Date.now() / 1000));

        set(importDialogOpenAtom, false);
        set(bookmarkNodesAtom, doc.nodes);
        set(bookmarkRootIdsAtom, doc.rootIds);
        set(bookmarkIconsAtom, doc.icons);

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

        const html = serializeNetscapeBookmarks({ nodes: get(bookmarkNodesAtom), rootIds, icons: get(bookmarkIconsAtom) });
        const stamp = new Date().toISOString().slice(0, 10);
        downloadTextFile(`bookmarks-${stamp}.html`, html, "text/html");
    }
);

/**
 * "Export": saves the given items as a bookmarks .html file, the same format as "Save bookmarks". A folder is
 * exported with everything inside it. One item is named after its title; several get a dated name.
 */
export const exportItemsAtom = atom(
    null,
    (get, _set, ids: ReadonlySet<BookmarkId>) => {
        const exported = selectionDocument({ nodes: get(bookmarkNodesAtom), rootIds: get(bookmarkRootIdsAtom), icons: get(bookmarkIconsAtom) }, ids);
        if (exported.rootIds.length === 0) {
            notice.info("Nothing to export. Select items first.");
            return;
        }

        const stamp = new Date().toISOString().slice(0, 10);
        downloadTextFile(exportFileName(exported, stamp), serializeNetscapeBookmarks(exported), "text/html");
        const count = exported.rootIds.length;
        notice.success(count === 1 ? "Exported 1 item." : `Exported ${count} items.`);
    }
);

//---------------------------------------------------------------------------
// Selection and expansion

/** Selects one item (and expands its ancestors, and the item itself when it is a folder), so it is visible in the tree. */
export const selectItemAtom = atom(
    null,
    (get, set, id: BookmarkId | null) => {
        set(pinnedFolderAtom, null);
        set(selectionPanelAtom, "tree");
        set(treeSelectedIdAtom, id);
        set(treeSelectedIdsAtom, id === null ? new Set() : new Set([id]));
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
 * Click on a tree row (scope "tree") or an item (scope "items"). The rules are the Windows Explorer ones (see
 * b-selection-logic.ts): a plain click selects only that item, Ctrl-click toggles it, Shift-click selects the range
 * from the anchor, and Ctrl+Shift-click adds that range to the selection.
 */
export const clickItemAtom = atom(
    null,
    (get, set, click: { id: BookmarkId; scope: "tree" | "items"; ctrl: boolean; shift: boolean; }) => {
        // Clicks in the right panel keep the panel on its current folder, even when the clicked item is a folder.
        const panelFolderId = get(currentFolderIdAtom);
        set(selectionPanelAtom, click.scope);
        if (click.scope === "tree" && !click.ctrl && !click.shift) {
            // A plain click on a folder also opens it in the tree.
            set(selectItemAtom, click.id);
        } else {
            selectClickedItem(get, set, click);
        }
        set(pinnedFolderAtom, click.scope === "items" ? { id: panelFolderId } : null);
    }
);

/** Clears the selection in both panels. */
function clearAllSelection(set: Setter) {
    set(treeSelectedIdAtom, null);
    set(treeSelectedIdsAtom, new Set());
    set(itemSelectedIdAtom, null);
    set(itemSelectedIdsAtom, new Set());
}

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
    // Each panel has its own selection, so clicks in one panel never change the other's.
    const isTree = click.scope === "tree";
    const idAtom = isTree ? treeSelectedIdAtom : itemSelectedIdAtom;
    const idsAtom = isTree ? treeSelectedIdsAtom : itemSelectedIdsAtom;
    const order = isTree ? get(visibleTreeIdsAtom) : get(currentItemIdsAtom);

    // Only this panel's selection changes. A click in the right panel never expands or selects anything in the tree.
    const next = selectionAfterClick({ anchor: get(idAtom), selected: get(idsAtom) }, order, click.id, click);
    set(idsAtom, new Set(next.selected));
    set(idAtom, next.anchor);
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
        // The arrows move the tree selection, so they start from the selected tree folder.
        const treeId = get(treeSelectedIdAtom);
        const selected = treeId === null ? undefined : get(bookmarkNodesAtom)[treeId];
        const index = treeId === null ? -1 : visible.indexOf(treeId);

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
        const ids = topmostIds(nodes, items);
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
        set(bookmarkIconsAtom, keepReferencedIcons(nodes, get(bookmarkIconsAtom)));
        clearAllSelection(set);
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
        set(loadBookmarkDocumentAtom, { nodes: {}, rootIds: [], icons: {} });
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
    const icons: BookmarkIcons = {};
    for (const doc of docs) {
        Object.assign(nodes, doc.nodes);
        rootIds.push(...doc.rootIds);
        Object.assign(icons, doc.icons);
    }
    return { nodes, rootIds, icons };
}

/** The icons that at least one link still refers to. Returns `icons` itself when nothing would be dropped. */
function keepReferencedIcons(nodes: BookmarkNodes, icons: BookmarkIcons): BookmarkIcons {
    const kept: BookmarkIcons = {};
    for (const node of Object.values(nodes)) {
        if (node.kind === "link" && node.iconId !== null && node.iconId in icons) {
            kept[node.iconId] = icons[node.iconId];
        }
    }
    return Object.keys(kept).length === Object.keys(icons).length ? icons : kept;
}

/**
 * Adds each imported file as a new top-level folder after the current items. The folder takes the file name,
 * and the file's top-level items move inside it. The "Bookmarks bar" flag is dropped, since the folder is no longer the bar.
 */
function appendImportedFolders(current: BookmarkDocument, files: PendingImportFile[], now: number): { doc: BookmarkDocument; folderIds: BookmarkId[]; } {
    const nodes: BookmarkNodes = { ...current.nodes };
    const rootIds = [...current.rootIds];
    const icons: BookmarkIcons = { ...current.icons };
    const folderIds: BookmarkId[] = [];

    for (const file of files) {
        const folderId = uuid();
        const childIds: BookmarkId[] = [];
        Object.assign(nodes, file.doc.nodes);
        Object.assign(icons, file.doc.icons);

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

    return { doc: { nodes, rootIds, icons }, folderIds };
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
