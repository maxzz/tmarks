import { type BookmarkDocument, type BookmarkId } from "../store/9-bookmark-types";

// Pure rules for importing files into the tree. No React, Jotai or store imports here, so the rules can be tested alone.

/** The folder title for an imported file: its name without the .html extension. */
export function importedFolderTitle(fileName: string): string {
    return fileName.replace(/\.html?$/i, "") || "Imported bookmarks";
}

/**
 * Moves the top-level links of a document into a new folder named `title`. The tree lists only folders, so a file
 * of loose links would otherwise show nothing there. The folder goes after the file's other top-level items.
 * A document without top-level links is returned unchanged.
 */
export function wrapTopLevelLinks(doc: BookmarkDocument, title: string, nowSeconds: number, newId: () => BookmarkId): BookmarkDocument {
    const links = doc.rootIds.filter((id) => doc.nodes[id]?.kind === "link");
    if (links.length === 0) {
        return doc;
    }

    const folderId = newId();
    const nodes = { ...doc.nodes };
    for (const id of links) {
        nodes[id] = { ...nodes[id], parentId: folderId };
    }
    nodes[folderId] = {
        kind: "folder",
        id: folderId,
        parentId: null,
        title,
        addDate: nowSeconds,
        lastModified: nowSeconds,
        childIds: links,
        isToolbar: false,
    };

    const rootIds = [...doc.rootIds.filter((id) => !links.includes(id)), folderId];
    return { nodes, rootIds, icons: doc.icons };
}
