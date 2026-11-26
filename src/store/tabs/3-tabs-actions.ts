import { atom, type Getter, type Setter } from "jotai";
import { notice } from "@/ui/local-ui/7-toaster";
import { uuid } from "@/utils/uuid";
import { type DropPlacement } from "@/components/2-main/4-dnd/0-dnd-types";
import { type BookmarkId } from "../store/9-bookmark-types";
import { currentFolderIdAtom, expandedIdsAtom, itemSelectedIdAtom, itemSelectedIdsAtom, pinnedFolderAtom, selectionPanelAtom } from "../store/a-bookmarks-atoms";
import { downloadTextFile } from "../io/download-text-file";
import { importedFolderTitle, wrapTopLevelLinks } from "../io/import-folders";
import { serializeNetscapeBookmarks } from "../io/netscape-serialize";
import { selectionDocument } from "../io/selection-export";
import { topmostIds } from "../store/b-selection-logic";
import { type OpenedFile, type TabId, type TabInfo, type TabSession, type TransferMode } from "./0-tabs-types";
import { EMPTY_DOCUMENT, EMPTY_HISTORY, initialViewOf, insertFragment, NEW_TAB_TITLE, removeItems, shownFolderIdOf, tabHeaderPlacement } from "./0-tabs-logic";
import { activeTabIdAtom, isTabModifiedAtom, tabBaselinesAtom, tabDocumentAtom, tabSessionsAtom, tabsAtom } from "./1-tabs-atoms";
import { activateTabAtom, replaceTabDocumentAtom, showSession } from "./2-tabs-swap";

//---------------------------------------------------------------------------
// Opening tabs

/** Opens an empty tab after the others and shows it. */
export const newTabAtom = atom(
    null,
    (get, set) => {
        const id = addTab(get, set, { id: uuid(), title: NEW_TAB_TITLE, fileName: null }, newSession(EMPTY_DOCUMENT));
        set(activateTabAtom, id);
    }
);

/**
 * Opens each imported file in its own tab, and shows the first of them. The tab shown now is used for the first
 * file when it is empty and unchanged, so an empty "Untitled" tab is not left behind.
 */
export const openFilesInTabsAtom = atom(
    null,
    (get, set, files: OpenedFile[]) => {
        const now = Math.floor(Date.now() / 1000);
        let firstId: TabId | null = null;

        files.forEach((file, index) => {
            const title = importedFolderTitle(file.name);
            // The tree lists only folders, so the file's top-level links go into a folder named after the file.
            const doc = wrapTopLevelLinks(file.doc, title, now, () => uuid());
            const session = newSession(doc);
            const info: TabInfo = { id: uuid(), title, fileName: file.name };

            if (index === 0 && isReusable(get)) {
                const shownId = get(activeTabIdAtom);
                set(tabsAtom, get(tabsAtom).map((tab) => tab.id === shownId ? { ...info, id: shownId } : tab));
                set(tabBaselinesAtom, { ...get(tabBaselinesAtom), [shownId]: doc });
                showSession(set, session);
                firstId = shownId;
                return;
            }

            const id = addTab(get, set, info, session);
            firstId ??= id;
        });

        if (firstId !== null) {
            set(activateTabAtom, firstId);
        }
    }
);

function newSession(doc: TabSession["doc"]): TabSession {
    return { doc, view: initialViewOf(doc), history: EMPTY_HISTORY };
}

/** Adds a hidden tab after the others, with its document as the saved state. */
function addTab(get: Getter, set: Setter, info: TabInfo, session: TabSession): TabId {
    set(tabSessionsAtom, { ...get(tabSessionsAtom), [info.id]: session });
    set(tabBaselinesAtom, { ...get(tabBaselinesAtom), [info.id]: session.doc });
    set(tabsAtom, [...get(tabsAtom), info]);
    return info.id;
}

function isReusable(get: Getter): boolean {
    const shownId = get(activeTabIdAtom);
    const doc = get(tabDocumentAtom(shownId));
    return doc !== undefined && doc.rootIds.length === 0 && !get(isTabModifiedAtom(shownId));
}

//---------------------------------------------------------------------------
// Closing tabs

/** The tab waiting for the user to choose Save or Don't save before it closes. */
export const closeTabDialogOpenAtom = atom(false);
export const pendingCloseTabIdAtom = atom<TabId | null>(null);

export const pendingCloseTabAtom = atom(
    (get): TabInfo | undefined => {
        const id = get(pendingCloseTabIdAtom);
        return get(tabsAtom).find((tab) => tab.id === id);
    }
);

/** Closes a tab, asking first when it has changes that were not saved to a file. */
export const requestCloseTabAtom = atom(
    null,
    (get, set, tabId: TabId) => {
        if (get(isTabModifiedAtom(tabId))) {
            set(pendingCloseTabIdAtom, tabId);
            set(closeTabDialogOpenAtom, true);
            return;
        }
        set(closeTabAtom, tabId);
    }
);

export const requestCloseActiveTabAtom = atom(
    null,
    (get, set) => {
        set(requestCloseTabAtom, get(activeTabIdAtom));
    }
);

export const cancelCloseTabAtom = atom(
    null,
    (_get, set) => {
        set(closeTabDialogOpenAtom, false);
    }
);

/** Choice in the close dialog: save the tab to a file, then close it. */
export const saveAndCloseTabAtom = atom(
    null,
    (get, set) => {
        const id = get(pendingCloseTabIdAtom);
        set(closeTabDialogOpenAtom, false);
        if (id !== null && set(saveTabAtom, id)) {
            set(closeTabAtom, id);
        }
    }
);

/** Choice in the close dialog: close the tab and drop its changes. */
export const discardAndCloseTabAtom = atom(
    null,
    (get, set) => {
        const id = get(pendingCloseTabIdAtom);
        set(closeTabDialogOpenAtom, false);
        if (id !== null) {
            set(closeTabAtom, id);
        }
    }
);

/**
 * Closes a tab without asking. Closing the shown tab shows its neighbor. Closing the last tab leaves one empty tab,
 * so there is always a tab to import into.
 */
export const closeTabAtom = atom(
    null,
    (get, set, tabId: TabId) => {
        const tabs = get(tabsAtom);
        const index = tabs.findIndex((tab) => tab.id === tabId);
        if (index < 0) {
            return;
        }

        let remaining = tabs.filter((tab) => tab.id !== tabId);
        const sessions = { ...get(tabSessionsAtom) };
        const baselines = { ...get(tabBaselinesAtom) };
        delete sessions[tabId];
        delete baselines[tabId];

        if (tabId === get(activeTabIdAtom)) {
            if (remaining.length === 0) {
                const empty: TabInfo = { id: uuid(), title: NEW_TAB_TITLE, fileName: null };
                remaining = [empty];
                sessions[empty.id] = newSession(EMPTY_DOCUMENT);
                baselines[empty.id] = EMPTY_DOCUMENT;
            }
            // The closed tab's state is in the document atoms; showing the neighbor replaces it, and nothing is parked.
            const nextId = remaining[Math.min(index, remaining.length - 1)].id;
            const next = sessions[nextId];
            delete sessions[nextId];

            set(tabSessionsAtom, sessions);
            set(tabBaselinesAtom, baselines);
            set(tabsAtom, remaining);
            set(activeTabIdAtom, nextId);
            showSession(set, next);
            return;
        }

        set(tabSessionsAtom, sessions);
        set(tabBaselinesAtom, baselines);
        set(tabsAtom, remaining);
    }
);

//---------------------------------------------------------------------------
// Saving

/**
 * Saves a tab as a bookmarks .html file, under the name of the file it was opened from. The tab is no longer
 * marked as modified. Returns `false` when there was nothing to save.
 */
export const saveTabAtom = atom(
    null,
    (get, set, tabId: TabId): boolean => {
        const doc = get(tabDocumentAtom(tabId));
        const tab = get(tabsAtom).find((candidate) => candidate.id === tabId);
        if (!doc || !tab) {
            return false;
        }
        if (doc.rootIds.length === 0) {
            notice.info("Nothing to save yet. Import a bookmarks file first.");
            return false;
        }

        const stamp = new Date().toISOString().slice(0, 10);
        downloadTextFile(tab.fileName ?? `bookmarks-${stamp}.html`, serializeNetscapeBookmarks(doc), "text/html");
        set(tabBaselinesAtom, { ...get(tabBaselinesAtom), [tabId]: doc });
        return true;
    }
);

export const saveActiveTabAtom = atom(
    null,
    (get, set) => {
        set(saveTabAtom, get(activeTabIdAtom));
    }
);

//---------------------------------------------------------------------------
// Moving and copying between tabs (Paste, and drag and drop)

export interface TabTransfer {
    sourceTabId: TabId;
    targetTabId: TabId;
    ids: BookmarkId[];
    mode: TransferMode;
    placement: DropPlacement;
}

/**
 * Copies or moves items from one tab to another. The items arrive with new ids, so both tabs keep their ids unique.
 * A move keeps the items' dates and removes them from the source tab. Each tab gets its own undo step. Returns
 * the ids of the items placed in the target tab, or `null` when nothing was placed.
 */
export const transferItemsAtom = atom(
    null,
    (get, set, transfer: TabTransfer): BookmarkId[] | null => {
        const { sourceTabId, targetTabId, ids, mode, placement } = transfer;
        const source = get(tabDocumentAtom(sourceTabId));
        const target = get(tabDocumentAtom(targetTabId));
        if (!source) {
            notice.info("The tab the items came from is closed.");
            return null;
        }
        if (!target) {
            return null;
        }

        const fragment = selectionDocument(source, new Set(ids));
        if (fragment.rootIds.length === 0) {
            notice.info("The items no longer exist.");
            return null;
        }

        const inserted = insertFragment(target, fragment, placement, mode === "copy" ? Math.floor(Date.now() / 1000) : null, () => uuid());
        if (!inserted) {
            notice.info("The items cannot be placed there.");
            return null;
        }

        set(replaceTabDocumentAtom, { tabId: targetTabId, doc: inserted.doc });
        if (mode === "move") {
            set(replaceTabDocumentAtom, { tabId: sourceTabId, doc: removeItems(source, fragment.rootIds) });
        }

        const intoShown = targetTabId === get(activeTabIdAtom);
        if (intoShown) {
            revealPlacedItems(get, set, inserted.doc.nodes[inserted.newIds[0]]?.parentId ?? null, inserted.newIds);
        }

        const verb = mode === "move" ? "Moved" : "Copied";
        const count = inserted.newIds.length === 1 ? "1 item" : `${inserted.newIds.length} items`;
        const other = tabTitleOf(get, intoShown ? sourceTabId : targetTabId);
        notice.success(`${verb} ${count} ${intoShown ? "from" : "to"} "${other}".`);
        return inserted.newIds;
    }
);

/** Opens the folder the items went into, and selects them when the right panel shows that folder. */
function revealPlacedItems(get: Getter, set: Setter, parentId: BookmarkId | null, ids: BookmarkId[]) {
    if (parentId !== null) {
        set(expandedIdsAtom, new Set([...get(expandedIdsAtom), parentId]));
    }
    if (parentId === get(currentFolderIdAtom)) {
        // Pin the folder so the right panel stays on it. Otherwise a pasted folder becomes the shown folder and opens.
        set(pinnedFolderAtom, { id: parentId });
        set(selectionPanelAtom, "items");
        set(itemSelectedIdsAtom, new Set(ids));
        set(itemSelectedIdAtom, ids[ids.length - 1] ?? null);
    }
}

/**
 * Where items dragged onto a tab's header would go in that tab (see `tabHeaderPlacement`), or `null` when the
 * header takes no drop. The source tab's own header takes none: hovering it shows the tab, so the drop can be aimed.
 */
export const tabHeaderDropPlacementAtom = atom(
    null,
    (get, _set, { targetTabId, sourceTabId, ids }: { targetTabId: TabId; sourceTabId: TabId; ids: BookmarkId[]; }): DropPlacement | null => {
        const source = get(tabDocumentAtom(sourceTabId));
        const target = get(tabDocumentAtom(targetTabId));
        if (targetTabId === sourceTabId || !source || !target) {
            return null;
        }

        const shownFolderId = targetTabId === get(activeTabIdAtom)
            ? get(currentFolderIdAtom)
            : shownFolderIdOf(get(tabSessionsAtom)[targetTabId].view, target.nodes);
        const kinds = topmostIds(source.nodes, new Set(ids)).map((id) => source.nodes[id].kind);
        return tabHeaderPlacement(shownFolderId, target.nodes, kinds);
    }
);

function tabTitleOf(get: Getter, tabId: TabId): string {
    return get(tabsAtom).find((tab) => tab.id === tabId)?.title ?? "";
}
