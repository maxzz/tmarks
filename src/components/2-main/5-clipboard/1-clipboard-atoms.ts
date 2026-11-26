import { atom, type Getter } from "jotai";
import { atomFamily } from "jotai-family";
import { notice } from "@/ui/local-ui/7-toaster";
import { uuid } from "@/utils/uuid";
import { type BookmarkId } from "@/store/store/9-bookmark-types";
import {
    bookmarkIconsAtom,
    bookmarkNodesAtom,
    bookmarkRootIdsAtom,
    currentFolderIdAtom,
    expandedIdsAtom,
    itemSelectedIdAtom,
    itemSelectedIdsAtom,
    selectionPanelAtom,
} from "@/store/store/a-bookmarks-atoms";
import { selectionDocument } from "@/store/io/selection-export";
import { writeSystemClipboard } from "@/store/io/system-clipboard";
import { activeTabIdAtom, type TabId, transferItemsAtom } from "@/store/tabs";
import { applyMove } from "../4-dnd/1-dnd-logic";
import { copyNodes } from "./0-clipboard-logic";

// Clipboard state and the Copy, Cut and Paste actions. Both panels and all tabs share the clipboard. The menu and the
// keyboard shortcuts (2-clipboard-keys.ts) only call these atoms. A paste in another tab than the one the items
// came from goes through the tabs (see store/tabs).

export interface Clipboard {
    mode: "copy" | "cut";
    ids: BookmarkId[];
    /** The tab the items were copied or cut in. */
    tabId: TabId;
}

/** What Copy or Cut stored, or `null` when the clipboard is empty. A new Copy or Cut replaces it. */
export const clipboardAtom = atom<Clipboard | null>(null);

/** Whether a row is cut and waiting to be pasted. Cut rows are dimmed until they are pasted or replaced. */
export const isCutAtomFamily = atomFamily(
    (id: BookmarkId) => atom((get) => {
        const clipboard = get(clipboardAtom);
        return clipboard?.mode === "cut" && clipboard.tabId === get(activeTabIdAtom) && clipboard.ids.includes(id);
    })
);

export const copyItemsAtom = atom(
    null,
    (get, set, ids: BookmarkId[]) => {
        if (ids.length > 0) {
            set(clipboardAtom, { mode: "copy", ids, tabId: get(activeTabIdAtom) });
            copyToSystemClipboard(get, ids);
        }
    }
);

export const cutItemsAtom = atom(
    null,
    (get, set, ids: BookmarkId[]) => {
        if (ids.length > 0) {
            set(clipboardAtom, { mode: "cut", ids, tabId: get(activeTabIdAtom) });
            copyToSystemClipboard(get, ids);
        }
    }
);

function copyToSystemClipboard(get: Getter, ids: BookmarkId[]) {
    const doc = { nodes: get(bookmarkNodesAtom), rootIds: get(bookmarkRootIdsAtom), icons: get(bookmarkIconsAtom) };
    writeSystemClipboard(selectionDocument(doc, new Set(ids)));
}

/**
 * Pastes the clipboard at the end of `parentId` (`null` for the top level). A copy makes new items. A cut moves the
 * original items, and then the clipboard is empty. The pasted items are selected when they land in the shown folder.
 */
export const pasteIntoAtom = atom(
    null,
    (get, set, parentId: BookmarkId | null) => {
        const clipboard = get(clipboardAtom);
        if (!clipboard) {
            notice.info("Nothing to paste. Copy or cut items first.");
            return;
        }

        const shownTabId = get(activeTabIdAtom);
        if (clipboard.tabId !== shownTabId) {
            const placed = set(transferItemsAtom, {
                sourceTabId: clipboard.tabId,
                targetTabId: shownTabId,
                ids: clipboard.ids,
                mode: clipboard.mode === "cut" ? "move" : "copy",
                placement: { kind: "end", parentId },
            });
            if (placed && clipboard.mode === "cut") {
                set(clipboardAtom, null);
            }
            return;
        }

        const nodes = get(bookmarkNodesAtom);
        const rootIds = get(bookmarkRootIdsAtom);
        const ids = clipboard.ids.filter((id) => nodes[id] !== undefined);
        if (ids.length === 0) {
            set(clipboardAtom, null);
            notice.info("The items on the clipboard no longer exist.");
            return;
        }

        let placed: BookmarkId[];
        if (clipboard.mode === "cut") {
            const moved = applyMove(nodes, rootIds, ids, { kind: "end", parentId });
            if (!moved) {
                notice.info("A folder cannot be pasted into itself.");
                return;
            }
            set(bookmarkNodesAtom, moved.nodes);
            set(bookmarkRootIdsAtom, moved.rootIds);
            set(clipboardAtom, null);
            placed = ids;
        } else {
            const now = Math.floor(Date.now() / 1000);
            const copied = copyNodes(nodes, rootIds, ids, parentId, now, () => uuid());
            if (!copied) {
                notice.info("A folder cannot be pasted into itself.");
                return;
            }
            set(bookmarkNodesAtom, copied.nodes);
            set(bookmarkRootIdsAtom, copied.rootIds);
            placed = copied.newIds;
        }

        if (parentId !== null) {
            set(expandedIdsAtom, new Set([...get(expandedIdsAtom), parentId]));
        }
        if (parentId === get(currentFolderIdAtom)) {
            set(selectionPanelAtom, "items");
            set(itemSelectedIdsAtom, new Set(placed));
            set(itemSelectedIdAtom, placed[placed.length - 1] ?? null);
        }

        notice.success(`${clipboard.mode === "cut" ? "Moved" : "Pasted"} ${placed.length === 1 ? "1 item" : `${placed.length} items`}.`);
    }
);
