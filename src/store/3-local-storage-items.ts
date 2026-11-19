import { notice } from "@/ui/local-ui/7-toaster";
import { type BookmarkDocument, type BookmarkIcons, type BookmarkId, type BookmarkLink, type BookmarkNode, type BookmarkNodes } from "./store/9-bookmark-types";
import { addIcon } from "./io/icon-id";

/** The bookmark tree, without icons. Links refer to icons by id; the icons are kept in IndexedDB (see io/icon-cache). */
const TREE_KEY = "tm-tmarks-tree-v2";

/** The format before the icon cache, where each link carried its icon inline. Converted on first load. */
const LEGACY_TREE_KEY = "tm-tmarks-tree-v1";

const EMPTY_DOCUMENT: BookmarkDocument = { nodes: {}, rootIds: [], icons: {} };

/**
 * Reads the tree kept from the last session. Its icons are not here: they are loaded from IndexedDB afterwards,
 * so `icons` is empty except for an old-format tree, which is converted in memory.
 */
export function readStoredBookmarks(): BookmarkDocument {
    try {
        const raw = localStorage.getItem(TREE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<BookmarkDocument> | null;
            if (parsed && isObject(parsed.nodes) && Array.isArray(parsed.rootIds)) {
                return { nodes: parsed.nodes, rootIds: parsed.rootIds, icons: {} };
            }
        }

        const legacy = localStorage.getItem(LEGACY_TREE_KEY);
        if (legacy) {
            return convertLegacyBookmarks(legacy);
        }
    } catch (e) {
        console.error("Failed to read stored bookmarks", e);
    }
    return EMPTY_DOCUMENT;
}

type LegacyLink = Omit<BookmarkLink, "iconId"> & { icon?: string | null; };

/**
 * Converts the old format in memory: each link's inline `icon` moves into the icon cache.
 * Nothing is written here; `completeLegacyTreeMigration` removes the old data once the icons are stored.
 */
function convertLegacyBookmarks(raw: string): BookmarkDocument {
    const parsed = JSON.parse(raw) as { nodes?: unknown; rootIds?: unknown; };
    if (!isObject(parsed.nodes) || !Array.isArray(parsed.rootIds)) {
        return EMPTY_DOCUMENT;
    }

    const icons: BookmarkIcons = {};
    const nodes: BookmarkNodes = {};
    for (const [id, value] of Object.entries(parsed.nodes)) {
        const node = value as BookmarkNode | LegacyLink;
        if (node.kind === "link") {
            const { icon, ...link } = node as LegacyLink;
            const hasIcon = typeof icon === "string" && icon.startsWith("data:image/");
            nodes[id] = { ...link, iconId: hasIcon ? addIcon(icons, icon) : null };
        } else {
            nodes[id] = node;
        }
    }

    return { nodes, rootIds: parsed.rootIds as BookmarkId[], icons };
}

/**
 * Finishes the conversion of the old format, once its icons are in IndexedDB: stores the tree in the new format
 * and removes the old tree. Does nothing when there is no old tree.
 */
export function completeLegacyTreeMigration(doc: BookmarkDocument): void {
    if (localStorage.getItem(LEGACY_TREE_KEY) === null) {
        return;
    }
    if (writeStoredTree(doc)) {
        localStorage.removeItem(LEGACY_TREE_KEY);
    }
}

let storageFull = false;

/**
 * Keeps the bookmark tree in localStorage, so it survives a reload. Icons are not included. Returns `false` when
 * the browser refused the write.
 */
export function writeStoredTree(doc: BookmarkDocument): boolean {
    try {
        localStorage.setItem(TREE_KEY, JSON.stringify({ nodes: doc.nodes, rootIds: doc.rootIds }));
        storageFull = false;
        return true;
    } catch (e) {
        console.error("Failed to store bookmarks", e);
        if (!storageFull) {
            storageFull = true;
            notice.error("The bookmarks are too large to keep in this browser. They will be lost on reload.");
        }
        return false;
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
