import { atom, type Getter, type Setter } from "jotai";
import { type BookmarkDocument } from "../store/9-bookmark-types";
import {
    bookmarkIconsAtom,
    bookmarkNodesAtom,
    bookmarkRootIdsAtom,
    editingIdAtom,
    expandedIdsAtom,
    itemSelectedIdAtom,
    itemSelectedIdsAtom,
    pinnedFolderAtom,
    selectionPanelAtom,
    treeSelectedIdAtom,
    treeSelectedIdsAtom,
} from "../store/a-bookmarks-atoms";
import { putHistoryAtom, takeHistoryAtom } from "../history/1-history-atoms";
import { type TabId, type TabSession, type TabView } from "./0-tabs-types";
import { pruneView, pushHistoryStep } from "./0-tabs-logic";
import { activeTabIdAtom, tabSessionsAtom } from "./1-tabs-atoms";

// Showing a tab. The shown tab lives in the document atoms; showing another one parks the shown tab's state in
// `tabSessionsAtom` and loads the other tab's state into the document atoms.

/** The state of the shown tab, read from the document atoms. Any change not yet in its history is recorded first. */
export function captureShownSession(get: Getter, set: Setter): TabSession {
    return {
        doc: readShownDocument(get),
        view: readShownView(get),
        history: set(takeHistoryAtom),
    };
}

/** Loads a tab's state into the document atoms. The previous content of the atoms is dropped. */
export function showSession(set: Setter, session: TabSession) {
    const { doc, view } = session;
    set(bookmarkNodesAtom, doc.nodes);
    set(bookmarkRootIdsAtom, doc.rootIds);
    set(bookmarkIconsAtom, doc.icons);

    set(expandedIdsAtom, view.expandedIds);
    set(treeSelectedIdAtom, view.treeSelectedId);
    set(treeSelectedIdsAtom, view.treeSelectedIds);
    set(itemSelectedIdAtom, view.itemSelectedId);
    set(itemSelectedIdsAtom, view.itemSelectedIds);
    set(selectionPanelAtom, view.selectionPanel);
    set(pinnedFolderAtom, view.pinnedFolder);
    set(editingIdAtom, null);

    set(putHistoryAtom, session.history);
}

/** Shows a tab. The tab that was shown keeps its document, selection and history until it is shown again. */
export const activateTabAtom = atom(
    null,
    (get, set, tabId: TabId) => {
        const shownId = get(activeTabIdAtom);
        const next = get(tabSessionsAtom)[tabId];
        if (tabId === shownId || !next) {
            return;
        }

        const parked = captureShownSession(get, set);
        const sessions = { ...get(tabSessionsAtom), [shownId]: parked };
        delete sessions[tabId];

        set(tabSessionsAtom, sessions);
        set(activeTabIdAtom, tabId);
        showSession(set, next);
    }
);

/**
 * Replaces the document of any tab, as one undoable step of that tab. For the shown tab the document atoms are set,
 * and the history module records the step. For a hidden tab the step is added to its own history.
 * Selected items that are gone are deselected.
 */
export const replaceTabDocumentAtom = atom(
    null,
    (get, set, { tabId, doc }: { tabId: TabId; doc: BookmarkDocument; }) => {
        if (tabId === get(activeTabIdAtom)) {
            set(bookmarkNodesAtom, doc.nodes);
            set(bookmarkRootIdsAtom, doc.rootIds);
            set(bookmarkIconsAtom, doc.icons);

            const view = readShownView(get);
            const pruned = pruneView(view, doc.nodes);
            if (pruned !== view) {
                set(treeSelectedIdAtom, pruned.treeSelectedId);
                set(treeSelectedIdsAtom, pruned.treeSelectedIds);
                set(itemSelectedIdAtom, pruned.itemSelectedId);
                set(itemSelectedIdsAtom, pruned.itemSelectedIds);
            }
            return;
        }

        const session = get(tabSessionsAtom)[tabId];
        if (!session) {
            return;
        }
        set(tabSessionsAtom, {
            ...get(tabSessionsAtom),
            [tabId]: {
                doc,
                view: pruneView(session.view, doc.nodes),
                history: pushHistoryStep(session.history, session.doc),
            },
        });
    }
);

export function readShownDocument(get: Getter): BookmarkDocument {
    return { nodes: get(bookmarkNodesAtom), rootIds: get(bookmarkRootIdsAtom), icons: get(bookmarkIconsAtom) };
}

export function readShownView(get: Getter): TabView {
    return {
        expandedIds: get(expandedIdsAtom),
        treeSelectedId: get(treeSelectedIdAtom),
        treeSelectedIds: get(treeSelectedIdsAtom),
        itemSelectedId: get(itemSelectedIdAtom),
        itemSelectedIds: get(itemSelectedIdsAtom),
        selectionPanel: get(selectionPanelAtom),
        pinnedFolder: get(pinnedFolderAtom),
    };
}
