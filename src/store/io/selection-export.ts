import { type BookmarkDocument, type BookmarkId, type BookmarkIcons, type BookmarkNodes } from "../store/9-bookmark-types";
import { topmostIds } from "../store/b-selection-logic";

// Pure rules for Export. The result is an ordinary document, so it is written by serializeNetscapeBookmarks.
// No React, Jotai or store imports here, so the rules can be tested alone.

/**
 * The document for "Export": the given items, with each folder carrying everything inside it. Items inside another
 * given folder are left out, since the folder already has them. The items keep their order in the tree. Ids that
 * are not in the tree are skipped. Icons are kept only for the links that are exported.
 */
export function selectionDocument(doc: BookmarkDocument, ids: ReadonlySet<BookmarkId>): BookmarkDocument {
    const order = treeOrder(doc);
    const roots = topmostIds(doc.nodes, ids)
        .filter((id) => order.has(id))
        .sort((a, b) => order.get(a)! - order.get(b)!);

    const nodes: BookmarkNodes = {};
    const icons: BookmarkIcons = {};

    const collect = (id: BookmarkId) => {
        const node = doc.nodes[id];
        if (!node || nodes[id]) {
            return;
        }
        if (node.kind === "link") {
            nodes[id] = node;
            if (node.iconId !== null && doc.icons[node.iconId] !== undefined) {
                icons[node.iconId] = doc.icons[node.iconId];
            }
            return;
        }
        nodes[id] = node;
        node.childIds.forEach(collect);
    };

    for (const id of roots) {
        collect(id);
        // The exported file has no containing folder for these, so they are top-level there.
        nodes[id] = { ...nodes[id], parentId: null };
    }

    return { nodes, rootIds: roots, icons };
}

/**
 * The file name for an export. One exported item is named after its title, so a folder exported alone becomes
 * "Work.html". Several items, or a title that cannot be used as a file name, get "bookmarks-<stamp>.html".
 */
export function exportFileName(exported: BookmarkDocument, stamp: string): string {
    const [only] = exported.rootIds;
    if (exported.rootIds.length === 1 && only !== undefined) {
        const name = exported.nodes[only].title.replace(/[\\/:*?"<>|]/g, "_").trim();
        if (name) {
            return `${name}.html`;
        }
    }
    return `bookmarks-${stamp}.html`;
}

/** Position of every node in the order the tree shows it (depth first, in file order). */
function treeOrder(doc: BookmarkDocument): Map<BookmarkId, number> {
    const order = new Map<BookmarkId, number>();
    const visit = (id: BookmarkId) => {
        if (order.has(id) || !doc.nodes[id]) {
            return;
        }
        order.set(id, order.size);
        const node = doc.nodes[id];
        if (node.kind === "folder") {
            node.childIds.forEach(visit);
        }
    };
    doc.rootIds.forEach(visit);
    return order;
}
