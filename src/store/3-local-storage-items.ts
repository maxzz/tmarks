import { notice } from "@/ui/local-ui/7-toaster";
import { type BookmarkDocument, type BookmarkIcons, type BookmarkId, type BookmarkLink, type BookmarkNode, type BookmarkNodes } from "./store/9-bookmark-types";
import { addIcon } from "./io/icon-id";

/** The bookmark tree. Links refer to icons by id. */
const TREE_KEY = "tm-tmarks-tree-v2";

/** The icon cache: every icon the tree refers to, stored once. */
const ICONS_KEY = "tm-tmarks-icons-v1";

/** The format before the icon cache, where each link carried its icon inline. Read once, then migrated. */
const LEGACY_TREE_KEY = "tm-tmarks-tree-v1";

const EMPTY_DOCUMENT: BookmarkDocument = { nodes: {}, rootIds: [], icons: {} };

/** Reads the bookmarks kept from the last session. Returns an empty document when there is none or it is unreadable. */
export function readStoredBookmarks(): BookmarkDocument {
    try {
        const raw = localStorage.getItem(TREE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<BookmarkDocument> | null;
            if (parsed && isObject(parsed.nodes) && Array.isArray(parsed.rootIds)) {
                return { nodes: parsed.nodes, rootIds: parsed.rootIds, icons: readStoredIcons() };
            }
        }

        const legacy = localStorage.getItem(LEGACY_TREE_KEY);
        if (legacy) {
            return migrateLegacyBookmarks(legacy);
        }
    } catch (e) {
        console.error("Failed to read stored bookmarks", e);
    }
    return EMPTY_DOCUMENT;
}

/** Reads the icon cache. A broken cache loses the icons only; the bookmarks still load. */
function readStoredIcons(): BookmarkIcons {
    try {
        const raw = localStorage.getItem(ICONS_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        return isObject(parsed) ? (parsed as BookmarkIcons) : {};
    } catch (e) {
        console.error("Failed to read stored icons", e);
        return {};
    }
}

type LegacyLink = Omit<BookmarkLink, "iconId"> & { icon?: string | null; };

/**
 * Converts the format from before the icon cache: each link's inline `icon` moves into the cache.
 * The legacy data is removed only after the new format is stored, so a failed save loses nothing.
 */
function migrateLegacyBookmarks(raw: string): BookmarkDocument {
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

    const doc: BookmarkDocument = { nodes, rootIds: parsed.rootIds as BookmarkId[], icons };
    if (writeStoredBookmarks(doc)) {
        localStorage.removeItem(LEGACY_TREE_KEY);
    }
    return doc;
}

let storageFull = false;

/** The icon cache as it was last written. An unchanged cache is not serialized again on every change. */
let lastWrittenIcons: BookmarkIcons | null = null;

/**
 * Keeps the whole document in localStorage, so it survives a reload. The icon cache is written first, so the
 * stored tree never refers to an icon that is not stored. Returns `false` when the browser refused the write.
 */
export function writeStoredBookmarks(doc: BookmarkDocument): boolean {
    try {
        if (doc.icons !== lastWrittenIcons) {
            localStorage.setItem(ICONS_KEY, JSON.stringify(doc.icons));
            lastWrittenIcons = doc.icons;
        }
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
