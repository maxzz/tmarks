import { createStore, delMany, get, getMany, setMany } from "idb-keyval";
import { type BookmarkId, type BookmarkNodes } from "../store/9-bookmark-types";
import { parseViewState, type ViewState } from "../view-state/0-view-state-logic";
import { type TabId, type TabInfo } from "./0-tabs-types";

// The open tabs, kept in IndexedDB: one entry for the list of tabs, and one entry per tab for its tree. Several trees
// can be far larger than the ~5 MB that localStorage allows. Icons are not here: all tabs share the icon cache
// (see io/icon-cache.ts), since icons are named by their content.

const tabsStore = createStore("tmarks-tabs", "tabs");

const META_KEY = "meta";

function treeKey(id: TabId): string {
    return `tree:${id}`;
}

/** One tab in the stored list. */
export interface StoredTab extends TabInfo {
    /** The tab had changes not saved to a file. It stays marked as modified after a reload. */
    modified: boolean;
    view: ViewState;
}

export interface StoredTabList {
    activeTabId: TabId;
    tabs: StoredTab[];
}

/** A tab's tree without icons. Links refer to icons by id. */
export interface StoredTree {
    nodes: BookmarkNodes;
    rootIds: BookmarkId[];
}

export interface StoredTabs {
    list: StoredTabList;
    trees: Record<TabId, StoredTree>;
}

/** Reads the tabs of the last session, or `null` when none were stored. Throws when IndexedDB cannot be read. */
export async function readStoredTabs(): Promise<StoredTabs | null> {
    const list = parseTabList(await get<unknown>(META_KEY, tabsStore));
    if (!list) {
        return null;
    }

    const values = await getMany<unknown>(list.tabs.map((tab) => treeKey(tab.id)), tabsStore);
    const trees: Record<TabId, StoredTree> = {};
    list.tabs.forEach((tab, index) => {
        trees[tab.id] = parseTree(values[index]) ?? { nodes: {}, rootIds: [] };
    });
    return { list, trees };
}

/** Writes the list of tabs and the trees that changed, and deletes the trees of closed tabs. */
export async function writeStoredTabs(list: StoredTabList | null, trees: [TabId, StoredTree][], closedIds: TabId[]): Promise<void> {
    const entries: [IDBValidKey, unknown][] = trees.map(([id, tree]) => [treeKey(id), tree]);
    if (list) {
        entries.push([META_KEY, list]);
    }
    if (entries.length > 0) {
        await setMany(entries, tabsStore);
    }
    if (closedIds.length > 0) {
        await delMany(closedIds.map(treeKey), tabsStore);
    }
}

//---------------------------------------------------------------------------
// Checks of what was read. Data from an earlier version, or damaged data, must not break the start.

function parseTabList(value: unknown): StoredTabList | null {
    if (!isObject(value) || typeof value.activeTabId !== "string" || !Array.isArray(value.tabs)) {
        return null;
    }
    const tabs = value.tabs.map(parseTab).filter((tab): tab is StoredTab => tab !== null);
    return tabs.length > 0 ? { activeTabId: value.activeTabId, tabs } : null;
}

function parseTab(value: unknown): StoredTab | null {
    if (!isObject(value) || typeof value.id !== "string" || typeof value.title !== "string") {
        return null;
    }
    return {
        id: value.id,
        title: value.title,
        fileName: typeof value.fileName === "string" ? value.fileName : null,
        modified: value.modified === true,
        view: parseViewState(value.view) ?? { expandedIds: [], selectedId: null },
    };
}

function parseTree(value: unknown): StoredTree | null {
    if (!isObject(value) || !isObject(value.nodes) || !Array.isArray(value.rootIds)) {
        return null;
    }
    return { nodes: value.nodes as BookmarkNodes, rootIds: value.rootIds as BookmarkId[] };
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
