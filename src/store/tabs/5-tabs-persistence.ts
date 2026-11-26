import { atom, getDefaultStore } from "jotai";
import { notice } from "@/ui/local-ui/7-toaster";
import { uuid } from "@/utils/uuid";
import { type BookmarkDocument, type BookmarkIcons } from "../store/9-bookmark-types";
import { bookmarkIconsAtom, bookmarkNodesAtom, bookmarkRootIdsAtom, expandedIdsAtom, loadLogAtom, treeSelectedIdAtom } from "../store/a-bookmarks-atoms";
import { pickReferencedIcons } from "../history/0-history-logic";
import { readStoredBookmarks, removeStoredBookmarks } from "../3-local-storage-items";
import { readStoredViewState, removeStoredViewState } from "../view-state/1-view-state-storage";
import { pruneViewState } from "../view-state/0-view-state-logic";
import { loadIconCache, saveIconCache } from "../io/icon-cache";
import { logDocumentStats } from "../io/document-stats";
import { type TabId, type TabInfo, type TabSession } from "./0-tabs-types";
import { EMPTY_DOCUMENT, EMPTY_HISTORY, mergeIcons, NEW_TAB_TITLE, restoredViewOf, savedViewOf } from "./0-tabs-logic";
import { activeTabIdAtom, isTabModifiedAtom, tabBaselinesAtom, tabDocumentAtom, tabSessionsAtom, tabsAtom, tabsRestoredAtom } from "./1-tabs-atoms";
import { showSession } from "./2-tabs-swap";
import { readStoredTabs, type StoredTab, type StoredTabList, type StoredTree, writeStoredTabs } from "./4-tabs-storage";

// Restores the tabs at startup, and saves them after every change, from store subscriptions (not from React).

const store = getDefaultStore();

interface RestoredTab {
    info: TabInfo;
    session: TabSession;
    modified: boolean;
}

/**
 * Reads the tabs of the last session and shows the one that was shown. On the first run of this version the single
 * tree that was kept in localStorage becomes the first tab. Saving starts only after this, so a failed read never
 * overwrites what is stored.
 */
export async function restoreTabs(): Promise<void> {
    let restored: { tabs: RestoredTab[]; activeTabId: TabId | null; migrated: boolean; };
    try {
        restored = await readTabs();
    } catch (e) {
        console.error("Failed to restore the tabs", e);
        notice.error("The saved bookmarks could not be read. Changes made now will not be kept after a reload.");
        install([emptyTab()], null);
        return;
    }

    install(restored.tabs.length > 0 ? restored.tabs : [emptyTab()], restored.activeTabId);
    for (const tab of restored.tabs) {
        if (tab.session.doc.rootIds.length > 0) {
            const title = `restored "${tab.info.title}" from storage`;
            logDocumentStats(title, tab.session.doc);
            store.set(loadLogAtom, (log) => [...log, title]);
        }
    }

    startSaving();
    if (restored.migrated) {
        // The old copy is removed only once the new one is written.
        void queue.then(() => {
            if (!saveFailed) {
                removeStoredBookmarks();
                removeStoredViewState();
            }
        });
    }
}

async function readTabs(): Promise<{ tabs: RestoredTab[]; activeTabId: TabId | null; migrated: boolean; }> {
    const stored = await readStoredTabs();
    if (stored) {
        const { icons } = await loadIconCache({});
        const tabs = stored.list.tabs.map((tab) => restoredTab(tab, stored.trees[tab.id], icons));
        return { tabs, activeTabId: stored.list.activeTabId, migrated: false };
    }

    // First run with tabs: the tree of the previous version, if there is one, opens as the first tab.
    const legacy = readStoredBookmarks();
    const { icons } = await loadIconCache(legacy.icons);
    if (legacy.rootIds.length === 0) {
        return { tabs: [], activeTabId: null, migrated: true };
    }
    const tab: StoredTab = {
        id: uuid(),
        title: "Bookmarks",
        fileName: null,
        modified: false,
        view: readStoredViewState() ?? { expandedIds: legacy.rootIds.filter((id) => legacy.nodes[id]?.kind === "folder"), selectedId: null },
    };
    return { tabs: [restoredTab(tab, legacy, icons)], activeTabId: tab.id, migrated: true };
}

function restoredTab(tab: StoredTab, tree: StoredTree, icons: BookmarkIcons): RestoredTab {
    const doc: BookmarkDocument = { nodes: tree.nodes, rootIds: tree.rootIds, icons: pickReferencedIcons(tree.nodes, icons) };
    return {
        info: { id: tab.id, title: tab.title, fileName: tab.fileName },
        session: { doc, view: restoredViewOf(tab.view, doc), history: EMPTY_HISTORY },
        modified: tab.modified,
    };
}

function emptyTab(): RestoredTab {
    return {
        info: { id: uuid(), title: NEW_TAB_TITLE, fileName: null },
        session: { doc: EMPTY_DOCUMENT, view: restoredViewOf(null, EMPTY_DOCUMENT), history: EMPTY_HISTORY },
        modified: false,
    };
}

const showSessionAtom = atom(
    null,
    (_get, set, session: TabSession) => {
        showSession(set, session);
    }
);

/** Puts the restored tabs into the atoms and shows the one that was shown, or the first. */
function install(tabs: RestoredTab[], activeTabId: TabId | null) {
    const shown = tabs.find((tab) => tab.info.id === activeTabId) ?? tabs[0];
    const sessions: Record<TabId, TabSession> = {};
    const baselines: Record<TabId, BookmarkDocument | null> = {};
    for (const tab of tabs) {
        baselines[tab.info.id] = tab.modified ? null : tab.session.doc;
        if (tab !== shown) {
            sessions[tab.info.id] = tab.session;
        }
    }

    store.set(tabsAtom, tabs.map((tab) => tab.info));
    store.set(tabSessionsAtom, sessions);
    store.set(tabBaselinesAtom, baselines);
    store.set(activeTabIdAtom, shown.info.id);
    store.set(showSessionAtom, shown.session);
    store.set(tabsRestoredAtom, true);
}

//---------------------------------------------------------------------------
// Saving. A change schedules one save in a microtask, so the changes of one action are written together.
// Saves run one at a time. Each writes only the trees that changed since the save before it.

/** Each tab's tree as last written. Trees are compared by identity: every change makes new objects. */
const written = new Map<TabId, StoredTree>();
let writtenList = "";
let writtenIcons: BookmarkIcons | null = null;

let queue: Promise<unknown> = Promise.resolve();
let scheduled = false;
let saveFailed = false;

function startSaving() {
    for (const watched of [
        bookmarkNodesAtom, bookmarkRootIdsAtom, bookmarkIconsAtom, expandedIdsAtom, treeSelectedIdAtom,
        tabsAtom, activeTabIdAtom, tabSessionsAtom, tabBaselinesAtom,
    ]) {
        store.sub(watched, scheduleSave);
    }
    scheduleSave();
}

function scheduleSave() {
    if (!scheduled) {
        scheduled = true;
        queueMicrotask(() => {
            scheduled = false;
            queue = queue.then(save).catch((e) => console.error("Failed to save the tabs", e));
        });
    }
}

async function save() {
    const tabs = store.get(tabsAtom);
    const activeTabId = store.get(activeTabIdAtom);
    const docs = new Map(tabs.map((tab) => [tab.id, store.get(tabDocumentAtom(tab.id)) ?? EMPTY_DOCUMENT]));

    // Icons are saved first, and the trees after them, so a stored tree never refers to an icon that is not stored.
    const icons = mergeIcons([...docs.values()].map((doc) => doc.icons));
    if (icons !== writtenIcons) {
        await saveIconCache(icons);
        writtenIcons = icons;
    }

    const trees: [TabId, StoredTree][] = [];
    for (const [id, doc] of docs) {
        const last = written.get(id);
        if (last?.nodes !== doc.nodes || last.rootIds !== doc.rootIds) {
            trees.push([id, { nodes: doc.nodes, rootIds: doc.rootIds }]);
        }
    }
    const closedIds = [...written.keys()].filter((id) => !docs.has(id));

    const list: StoredTabList = {
        activeTabId,
        tabs: tabs.map((tab) => ({
            ...tab,
            modified: store.get(isTabModifiedAtom(tab.id)),
            view: pruneViewState(savedViewOf(viewOf(tab.id, activeTabId)), docs.get(tab.id)!.nodes),
        })),
    };
    const listJson = JSON.stringify(list);
    const listChanged = listJson !== writtenList;

    if (trees.length === 0 && closedIds.length === 0 && !listChanged) {
        return;
    }

    try {
        await writeStoredTabs(listChanged ? list : null, trees, closedIds);
        saveFailed = false;
    } catch (e) {
        console.error("Failed to store the tabs", e);
        if (!saveFailed) {
            saveFailed = true;
            notice.error("The bookmarks could not be saved in this browser. They will be lost on reload.");
        }
        return;
    }

    for (const [id, tree] of trees) {
        written.set(id, tree);
    }
    for (const id of closedIds) {
        written.delete(id);
    }
    writtenList = listJson;
}

function viewOf(tabId: TabId, activeTabId: TabId) {
    if (tabId === activeTabId) {
        return { expandedIds: store.get(expandedIdsAtom), treeSelectedId: store.get(treeSelectedIdAtom) };
    }
    return store.get(tabSessionsAtom)[tabId]?.view ?? { expandedIds: new Set<string>(), treeSelectedId: null };
}
