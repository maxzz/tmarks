import { type BookmarkId, type BookmarkNode, type BookmarkNodes } from "../store/9-bookmark-types";

// Pure rules for adding a new folder or bookmark. No React, Jotai or store imports here, so the rules can be tested alone.

export type NewItemKind = "folder" | "link";

export const NEW_FOLDER_TITLE = "New folder";

/** A typed address as a URL: one without a scheme ("example.com") gets "https://". Returns "" for empty input. */
export function normalizeUrl(input: string): string {
    const url = input.trim();
    if (url === "") {
        return "";
    }
    return /^[a-z][a-z\d+.-]*:/i.test(url) ? url : `https://${url}`;
}

/** The name a new item gets: the typed name, or for a bookmark without one, its URL. */
export function newItemTitle(kind: NewItemKind, title: string, url: string): string {
    const trimmed = title.trim();
    return trimmed === "" && kind === "link" ? url : trimmed;
}

export interface NewItem {
    kind: NewItemKind;
    title: string;
    /** Used for bookmarks only. */
    url: string;
}

/**
 * Adds a new folder or bookmark at the end of `parentId` (`null` for the top level). Returns `null` when the parent
 * is not a folder, or when the name (or a bookmark's URL) is empty.
 */
export function addNewItem(
    doc: { nodes: BookmarkNodes; rootIds: BookmarkId[]; },
    parentId: BookmarkId | null,
    item: NewItem,
    id: BookmarkId,
    now: number,
): { nodes: BookmarkNodes; rootIds: BookmarkId[]; } | null {
    const parent = parentId === null ? null : doc.nodes[parentId];
    if (parent !== null && parent?.kind !== "folder") {
        return null;
    }

    const url = item.kind === "link" ? normalizeUrl(item.url) : "";
    const title = newItemTitle(item.kind, item.title, url);
    if (title === "" || (item.kind === "link" && url === "")) {
        return null;
    }

    const node: BookmarkNode = item.kind === "folder"
        ? { kind: "folder", id, parentId, title, addDate: now, lastModified: now, childIds: [], isToolbar: false }
        : { kind: "link", id, parentId, title, addDate: now, lastModified: now, url, iconId: null };

    const nodes: BookmarkNodes = { ...doc.nodes, [id]: node };
    if (parent === null) {
        return { nodes, rootIds: [...doc.rootIds, id] };
    }
    nodes[parent.id] = { ...parent, childIds: [...parent.childIds, id] };
    return { nodes, rootIds: doc.rootIds };
}
