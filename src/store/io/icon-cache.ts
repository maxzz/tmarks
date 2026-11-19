import { createStore, delMany, entries, setMany } from "idb-keyval";
import { notice } from "@/ui/local-ui/7-toaster";
import { type BookmarkIcons, type IconId } from "../store/9-bookmark-types";

/**
 * The icon cache, kept in IndexedDB. localStorage allows only about 5 MB per site, while IndexedDB allows far more,
 * so icons no longer compete with the bookmark tree for that space.
 */
const iconStore = createStore("tmarks", "icons");

/** Icons kept in localStorage by the previous version. Moved to IndexedDB once, then removed. */
const LEGACY_ICONS_KEY = "tm-tmarks-icons-v1";

/** Ids of the icons currently in IndexedDB, so each save writes only the difference. */
let savedIds = new Set<IconId>();

/** The cache object last saved. Saving the same object again needs no work. */
let lastSaved: BookmarkIcons | null = null;

/** Operations run one at a time, in the order they were requested, so a save never overtakes an earlier one. */
let queue: Promise<unknown> = Promise.resolve();

let storageFailed = false;

/**
 * Reads the icons from IndexedDB, merges in the icons of the previous version and the icons already in memory,
 * and saves whatever is missing. `saved` tells whether that save succeeded.
 */
export function loadIconCache(current: BookmarkIcons): Promise<{ icons: BookmarkIcons; saved: boolean; }> {
    return enqueue(async () => {
        const stored: BookmarkIcons = Object.fromEntries(await entries<string, string>(iconStore));
        savedIds = new Set(Object.keys(stored));

        const legacy = takeLegacyIcons();
        const icons: BookmarkIcons = { ...stored, ...legacy, ...current };
        const saved = await writeDifference(icons);
        if (saved && legacy !== null) {
            localStorage.removeItem(LEGACY_ICONS_KEY);
        }
        return { icons, saved };
    });
}

/** Brings IndexedDB in line with `icons`: writes the icons that are new and deletes the ones that are gone. */
export function saveIconCache(icons: BookmarkIcons): Promise<boolean> {
    return enqueue(() => writeDifference(icons));
}

async function writeDifference(icons: BookmarkIcons): Promise<boolean> {
    if (icons === lastSaved) {
        return true;
    }

    const added = Object.entries(icons).filter(([id]) => !savedIds.has(id));
    const removed = [...savedIds].filter((id) => !(id in icons));
    try {
        if (added.length > 0) {
            await setMany(added, iconStore);
        }
        if (removed.length > 0) {
            await delMany(removed, iconStore);
        }
        savedIds = new Set(Object.keys(icons));
        lastSaved = icons;
        storageFailed = false;
        return true;
    } catch (e) {
        console.error("Failed to store icons", e);
        if (!storageFailed) {
            storageFailed = true;
            notice.error("The icons could not be saved in this browser. They will be lost on reload.");
        }
        return false;
    }
}

/** Reads the icons left by the previous version. Returns `null` when there are none. */
function takeLegacyIcons(): BookmarkIcons | null {
    const raw = localStorage.getItem(LEGACY_ICONS_KEY);
    if (raw === null) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        return typeof parsed === "object" && parsed !== null ? (parsed as BookmarkIcons) : {};
    } catch (e) {
        console.error("Failed to read the legacy icon cache", e);
        return {};
    }
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
}
