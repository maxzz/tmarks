import { type BookmarkFolder, type BookmarkId, type BookmarkNodes } from "@/store/store/9-bookmark-types";
import { normalizeDragIds, planMove } from "../4-dnd/1-dnd-logic";

// Pure copy rules for Copy and Paste. No React, Jotai or store imports here, so the rules can be tested alone.

export interface CopyResult {
    nodes: BookmarkNodes;
    rootIds: BookmarkId[];
    /** The ids of the copies at the top of the pasted items, in the order they were copied. */
    newIds: BookmarkId[];
}

/**
 * Copies items into `parentId` (`null` for the top level). A folder is copied with everything inside it, and every
 * copy gets a new id. Icons are shared by id, so copies keep the icon they had. Returns `null` when the copy is not
 * allowed (for example a folder into itself) or when none of the ids exist.
 */
export function copyNodes(
    nodes: BookmarkNodes,
    rootIds: BookmarkId[],
    ids: BookmarkId[],
    parentId: BookmarkId | null,
    now: number,
    newId: () => BookmarkId,
): CopyResult | null {
    if (!planMove(nodes, ids, { kind: "end", parentId })) {
        return null;
    }

    const sources = normalizeDragIds(nodes, ids);
    const next: BookmarkNodes = { ...nodes };

    const clone = (id: BookmarkId, newParentId: BookmarkId | null): BookmarkId => {
        const node = nodes[id];
        const copyId = newId();
        if (node.kind === "link") {
            next[copyId] = { ...node, id: copyId, parentId: newParentId, addDate: now, lastModified: now };
            return copyId;
        }

        // The copies of the children are made from the original tree, so the loop cannot run away.
        const childIds = node.childIds
            .filter((childId) => nodes[childId] !== undefined)
            .map((childId) => clone(childId, copyId));
        next[copyId] = { ...node, id: copyId, parentId: newParentId, childIds, isToolbar: false, addDate: now, lastModified: now };
        return copyId;
    };

    const newIds = sources.map((id) => clone(id, parentId));

    if (parentId === null) {
        return { nodes: next, rootIds: [...rootIds, ...newIds], newIds };
    }

    const folder = next[parentId] as BookmarkFolder;
    next[parentId] = { ...folder, childIds: [...folder.childIds, ...newIds] };
    return { nodes: next, rootIds, newIds };
}
