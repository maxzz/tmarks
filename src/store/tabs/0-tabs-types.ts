import { type BookmarkDocument, type BookmarkId } from "../store/9-bookmark-types";
import { type HistoryStacks } from "../history/0-history-logic";

/** Identifier of an open tab. Each tab holds one bookmarks document. */
export type TabId = string;

/** What the tab strip shows for a tab. */
export interface TabInfo {
    id: TabId;
    title: string;
    /** Name of the file the tab was opened from, used again when the tab is saved. `null` for a new tab. */
    fileName: string | null;
}

/** Selection, open folders and the pinned folder of a tab: the UI state in store/store/a-bookmarks-atoms.ts. */
export interface TabView {
    expandedIds: ReadonlySet<BookmarkId>;
    treeSelectedId: BookmarkId | null;
    treeSelectedIds: ReadonlySet<BookmarkId>;
    itemSelectedId: BookmarkId | null;
    itemSelectedIds: ReadonlySet<BookmarkId>;
    selectionPanel: "tree" | "items";
    pinnedFolder: { id: BookmarkId | null; } | null;
}

/**
 * Everything a hidden tab keeps while another tab is shown. The shown tab lives in the document atoms instead,
 * so all the existing panels, dialogs and actions work on it unchanged.
 */
export interface TabSession {
    doc: BookmarkDocument;
    view: TabView;
    history: HistoryStacks;
}

/** A file read by Import, to be opened in a tab. */
export interface OpenedFile {
    name: string;
    doc: BookmarkDocument;
}

/** What a transfer between tabs does with the original items: `copy` keeps them, `move` removes them. */
export type TransferMode = "copy" | "move";
