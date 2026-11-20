import { atom } from "jotai";
import { type BookmarkId } from "@/store/store/9-bookmark-types";
import { bookmarkNodesAtom, bookmarkRootIdsAtom, expandedIdsAtom } from "@/store/store/a-bookmarks-atoms";
import { type DropPlacement } from "./0-dnd-types";
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
