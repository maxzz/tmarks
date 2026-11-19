import { type BookmarkIcons, type IconId } from "../store/9-bookmark-types";

/**
 * Content-based id for an icon, so the same image always maps to the same cache entry.
 *
 * Uses cyrb53, a fast non-cryptographic 53-bit hash. It is synchronous and works on every origin
 * (`crypto.subtle` needs a secure context). A collision would only show the wrong favicon, never lose bookmarks.
 */
export function iconIdOf(dataUrl: string): IconId {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < dataUrl.length; i++) {
        const ch = dataUrl.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Adds an icon to the cache (if it is not there yet) and returns its id. */
export function addIcon(icons: BookmarkIcons, dataUrl: string): IconId {
    const id = iconIdOf(dataUrl);
    if (!(id in icons)) {
        icons[id] = dataUrl;
    }
    return id;
}
