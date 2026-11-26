import { atom } from "jotai";
import { type BookmarkId } from "@/store/store/9-bookmark-types";
import { bookmarkNodesAtom, bookmarkRootIdsAtom, expandedIdsAtom } from "@/store/store/a-bookmarks-atoms";
import { transferItemsAtom } from "@/store/tabs";
import { type DragSession, type DropPlacement, type DropTarget } from "./0-dnd-types";
import { applyMove } from "./1-dnd-logic";

/**
 * Moves items (links and folders) to a drop place. A drop that is not allowed (for example a folder into itself)
 * changes nothing. Dropping into a folder also opens it, so the moved items can be seen in the tree.
 */
export const moveBookmarksAtom = atom(
    null,
    (get, set, move: { ids: BookmarkId[]; placement: DropPlacement; }) => {
        const result = applyMove(get(bookmarkNodesAtom), get(bookmarkRootIdsAtom), move.ids, move.placement);
        if (!result) {
            return;
        }

        set(bookmarkNodesAtom, result.nodes);
        set(bookmarkRootIdsAtom, result.rootIds);
        if (move.placement.kind === "into") {
            set(expandedIdsAtom, new Set([...get(expandedIdsAtom), move.placement.folderId]));
        }
    }
);

/**
 * Ends a drag at a drop target. Inside the tab the items came from, they move. Into another tab they move too, or
 * are copied when Ctrl (Cmd on macOS) is held at release.
 */
export const dropBookmarksAtom = atom(
    null,
    (_get, set, { session, target, copy }: { session: DragSession; target: DropTarget; copy: boolean; }) => {
        if (target.tabId === session.sourceTabId) {
            set(moveBookmarksAtom, { ids: session.ids, placement: target.placement });
            return;
        }
        set(transferItemsAtom, {
            sourceTabId: session.sourceTabId,
            targetTabId: target.tabId,
            ids: session.ids,
            mode: copy ? "copy" : "move",
            placement: target.placement,
        });
    }
);
