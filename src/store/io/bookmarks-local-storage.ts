import { notice } from "@/ui/local-ui/7-toaster";
import { type BookmarkDocument } from "../store/9-bookmark-types";

const STORAGE_KEY = "tm-bookmarks-v1";

const EMPTY_DOCUMENT: BookmarkDocument = { nodes: {}, rootIds: [] };

/** Reads the bookmarks kept from the last session. Returns an empty document when there is none or it is unreadable. */
export function readStoredBookmarks(): BookmarkDocument {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return EMPTY_DOCUMENT;
        }

        const parsed = JSON.parse(raw) as Partial<BookmarkDocument> | null;
        if (parsed && typeof parsed.nodes === "object" && parsed.nodes !== null && Array.isArray(parsed.rootIds)) {
            return { nodes: parsed.nodes, rootIds: parsed.rootIds };
        }
    } catch (e) {
        console.error("Failed to read stored bookmarks", e);
    }
    return EMPTY_DOCUMENT;
}

let storageFull = false;

/** Keeps the whole document in localStorage, so it survives a reload. Icons are inline, so large libraries can exceed the quota. */
export function writeStoredBookmarks(doc: BookmarkDocument): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
        storageFull = false;
    } catch (e) {
        console.error("Failed to store bookmarks", e);
        if (!storageFull) {
            storageFull = true;
            notice.error("The bookmarks are too large to keep in this browser. They will be lost on reload.");
        }
    }
}
