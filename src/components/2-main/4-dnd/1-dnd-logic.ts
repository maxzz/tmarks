import { type BookmarkFolder, type BookmarkId, type BookmarkNode, type BookmarkNodes } from "@/store/store/9-bookmark-types";
import { type DropPlacement } from "./0-dnd-types";

// Pure drag-and-drop rules for the bookmark tree. No React, Jotai or Motion here, so the rules can be tested alone.

/** A folder row takes a drop inside it in its middle part. The top and bottom quarters put the drop before or after it. */
const FOLDER_EDGE = 0.25;

/**
 * Where the pointer is on a row. `pos` is the position along the row's axis: 0 at the top (or left) edge,
 * 1 at the bottom (or right) edge.
 */
export function placementAt(kind: BookmarkNode["kind"], pos: number): "before" | "after" | "into" {
    if (kind === "folder") {
        if (pos < FOLDER_EDGE) {
            return "before";
        }
        if (pos > 1 - FOLDER_EDGE) {
            return "after";
        }
        return "into";
    }
    return pos < 0.5 ? "before" : "after";
}

/** Keeps the dragged items that are not inside another dragged item. Those inside a dragged folder move with it. */
export function normalizeDragIds(nodes: BookmarkNodes, ids: BookmarkId[]): BookmarkId[] {
    const picked = new Set(ids.filter((id) => nodes[id] !== undefined));
    return [...picked].filter((id) => !hasAncestorIn(nodes, id, picked));
}

/** Checks a drop. Returns the items to move and their new parent, or `null` when the drop is not allowed. */
export function planMove(nodes: BookmarkNodes, ids: BookmarkId[], placement: DropPlacement): MovePlan | null {
    const moving = normalizeDragIds(nodes, ids);
    if (moving.length === 0) {
        return null;
    }

    const target = targetParentOf(nodes, moving, placement);
    if (target === null) {
        return null;
    }

    // A folder cannot go into itself or into one of its own descendants.
    const parentId = target.parentId;
    if (parentId !== null && moving.some((id) => nodes[id]?.kind === "folder" && isSameOrInside(nodes, parentId, id))) {
        return null;
    }

    return { parentId, moving };
}

export interface MovePlan {
    /** The new parent folder, or `null` for the top level. */
    parentId: BookmarkId | null;
    /** The items to move, in the order they should appear. */
    moving: BookmarkId[];
}

/**
 * Applies a drop to the document. Returns the new nodes and top-level ids, or `null` when the drop is not allowed.
 * Pure: the caller stores the result.
 */
export function applyMove(nodes: BookmarkNodes, rootIds: BookmarkId[], ids: BookmarkId[], placement: DropPlacement): MoveResult | null {
    const plan = planMove(nodes, ids, placement);
    if (!plan) {
        return null;
    }

    const { parentId, moving } = plan;
    const movingSet = new Set(moving);
    const next: BookmarkNodes = { ...nodes };
    let roots = rootIds.filter((id) => !movingSet.has(id));

    // Take the items out of the folders they are in now.
    for (const id of moving) {
        const from = nodes[id]?.parentId ?? null;
        const folder = from === null ? undefined : next[from];
        if (folder?.kind === "folder") {
            next[folder.id] = { ...folder, childIds: folder.childIds.filter((childId) => !movingSet.has(childId)) };
        }
    }

    // Put them in their new parent, at the position the placement asks for.
    for (const id of moving) {
        next[id] = { ...next[id], parentId };
    }

    const siblings = parentId === null ? roots : childIdsOf(next[parentId]);
    const index = insertIndex(siblings, placement);
    if (index < 0) {
        return null;
    }

    const inserted = [...siblings.slice(0, index), ...moving, ...siblings.slice(index)];
    if (parentId === null) {
        roots = inserted;
    } else {
        next[parentId] = { ...(next[parentId] as BookmarkFolder), childIds: inserted };
    }

    return { nodes: next, rootIds: roots };
}

export interface MoveResult {
    nodes: BookmarkNodes;
    rootIds: BookmarkId[];
}

/** The parent that a placement drops into, or `null` when it cannot take these items. */
function targetParentOf(nodes: BookmarkNodes, moving: BookmarkId[], placement: DropPlacement): { parentId: BookmarkId | null; } | null {
    switch (placement.kind) {
        case "into":
            return nodes[placement.folderId]?.kind === "folder" ? { parentId: placement.folderId } : null;

        case "end":
            return placement.parentId === null || nodes[placement.parentId]?.kind === "folder" ? { parentId: placement.parentId } : null;

        case "before":
        case "after": {
            const anchor = nodes[placement.anchorId];
            // Dropping an item next to itself does nothing.
            if (!anchor || moving.includes(placement.anchorId)) {
                return null;
            }
            return { parentId: anchor.parentId };
        }
    }
}

/** Where in the target's children the items go, counting the children after the moved items were taken out. */
function insertIndex(siblings: BookmarkId[], placement: DropPlacement): number {
    if (placement.kind === "before" || placement.kind === "after") {
        const at = siblings.indexOf(placement.anchorId);
        if (at < 0) {
            return -1;
        }
        return placement.kind === "before" ? at : at + 1;
    }
    return siblings.length;
}

function childIdsOf(node: BookmarkNode | undefined): BookmarkId[] {
    return node?.kind === "folder" ? node.childIds : [];
}

/** True when `id` is `ancestorId` or lies inside it. */
function isSameOrInside(nodes: BookmarkNodes, id: BookmarkId, ancestorId: BookmarkId): boolean {
    for (let current: BookmarkId | null = id; current !== null; current = nodes[current]?.parentId ?? null) {
        if (current === ancestorId) {
            return true;
        }
    }
    return false;
}

function hasAncestorIn(nodes: BookmarkNodes, id: BookmarkId, set: ReadonlySet<BookmarkId>): boolean {
    for (let parentId = nodes[id]?.parentId ?? null; parentId !== null; parentId = nodes[parentId]?.parentId ?? null) {
        if (set.has(parentId)) {
            return true;
        }
    }
    return false;
}
