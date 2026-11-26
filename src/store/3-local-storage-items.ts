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
 * Nothing is written here; `removeStoredBookmarks` removes the old data once it is stored in the new place.
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

/** Removes the tree of both formats, once it has been moved to the tabs in IndexedDB (see store/tabs). */
export function removeStoredBookmarks(): void {
    localStorage.removeItem(TREE_KEY);
    localStorage.removeItem(LEGACY_TREE_KEY);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
