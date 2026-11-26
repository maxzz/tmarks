import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import { type BookmarkDocument } from "../store/9-bookmark-types";
import { bookmarkIconsAtom, bookmarkNodesAtom, bookmarkRootIdsAtom } from "../store/a-bookmarks-atoms";
import { isSameTree } from "../history/0-history-logic";
import { type TabId, type TabInfo, type TabSession } from "./0-tabs-types";

// Tab state. The shown tab's document, selection and history live in the existing atoms (store/store and
// store/history), so every panel works on it unchanged. The hidden tabs are kept in `tabSessionsAtom` until shown.

/** The open tabs, in the order of the tab strip. There is always at least one once the tabs are restored. */
export const tabsAtom = atom<TabInfo[]>([]);

/** The tab that is shown. Its state is in the document atoms, not in `tabSessionsAtom`. */
export const activeTabIdAtom = atom<TabId>("");

/** The hidden tabs, by id. The shown tab has no entry here. */
export const tabSessionsAtom = atom<Record<TabId, TabSession>>({});

/**
 * The document of each tab as it was last saved to a file, or opened from one. A tab whose document differs is
 * marked as modified. `null` means modified in an earlier session: the tab stays modified until it is saved.
 */
export const tabBaselinesAtom = atom<Record<TabId, BookmarkDocument | null>>({});

/** False until the tabs of the last session are read from IndexedDB. Nothing is shown before that. */
export const tabsRestoredAtom = atom(false);

//---------------------------------------------------------------------------
// Per-tab atoms: each tab header subscribes only to its own tab

export const isActiveTabAtom = atomFamily(
    (tabId: TabId) => atom(
        (get) => get(activeTabIdAtom) === tabId
    )
);

/** The document of any tab: from the document atoms for the shown tab, from its session for a hidden one. */
export const tabDocumentAtom = atomFamily(
    (tabId: TabId) => atom(
        (get): BookmarkDocument | undefined => {
            if (get(activeTabIdAtom) === tabId) {
                return { nodes: get(bookmarkNodesAtom), rootIds: get(bookmarkRootIdsAtom), icons: get(bookmarkIconsAtom) };
            }
            return get(tabSessionsAtom)[tabId]?.doc;
        }
    )
);

/** Whether a tab has changes that were not saved to a file. Undoing back to the saved state clears it again. */
export const isTabModifiedAtom = atomFamily(
    (tabId: TabId) => atom(
        (get) => {
            const doc = get(tabDocumentAtom(tabId));
            const baseline = get(tabBaselinesAtom)[tabId];
            if (!doc || baseline === undefined) {
                return false;
            }
            return baseline === null || !isSameTree(baseline, doc);
        }
    )
);

export const activeTabAtom = atom(
    (get): TabInfo | undefined => {
        const id = get(activeTabIdAtom);
        return get(tabsAtom).find((tab) => tab.id === id);
    }
);
