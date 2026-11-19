import { type BookmarkDocument } from "../store/9-bookmark-types";

export interface DocumentStats {
    folders: number;
    links: number;
    linksWithIcon: number;
    /** Entries in the icon cache. Each distinct icon is counted once. */
    uniqueIcons: number;
    /** Characters of icon data in the cache (each unique icon once). */
    iconCacheChars: number;
    /** Characters of icon data if every link stored its own copy, as the previous format did. */
    perLinkIconChars: number;
}

export function documentStats(doc: BookmarkDocument): DocumentStats {
    let folders = 0;
    let links = 0;
    let linksWithIcon = 0;
    let perLinkIconChars = 0;

    for (const node of Object.values(doc.nodes)) {
        if (node.kind === "folder") {
            folders++;
            continue;
        }

        links++;
        const icon = node.iconId === null ? undefined : doc.icons[node.iconId];
        if (icon) {
            linksWithIcon++;
            perLinkIconChars += icon.length;
        }
    }

    const icons = Object.values(doc.icons);
    let iconCacheChars = 0;
    for (const icon of icons) {
        iconCacheChars += icon.length;
    }

    return { folders, links, linksWithIcon, uniqueIcons: icons.length, iconCacheChars, perLinkIconChars };
}

/** Prints the document's statistics as a collapsed console group. */
export function logDocumentStats(title: string, doc: BookmarkDocument): void {
    const s = documentStats(doc);
    const savedChars = s.perLinkIconChars - s.iconCacheChars;
    const savedPercent = s.perLinkIconChars > 0 ? (100 * savedChars) / s.perLinkIconChars : 0;

    console.groupCollapsed(`[bookmarks] ${title}`);
    console.table([
        { item: "Folders processed", value: s.folders.toLocaleString() },
        { item: "URLs (links) processed", value: s.links.toLocaleString() },
        { item: "Links with an icon", value: s.linksWithIcon.toLocaleString() },
        { item: "Unique icons in cache", value: s.uniqueIcons.toLocaleString() },
        { item: "Icon data in cache", value: formatChars(s.iconCacheChars) },
        { item: "Icon data if stored per link (old format)", value: formatChars(s.perLinkIconChars) },
        { item: "Saved by sharing icons", value: `${formatChars(savedChars)} (${savedPercent.toFixed(1)}%)` },
    ]);
    console.log("Sizes: characters of base64 text, which is about one byte each. KB = 1024 characters.");
    console.groupEnd();
}

function formatChars(count: number): string {
    if (count < 1024) {
        return `${count} chars`;
    }
    if (count < 1024 * 1024) {
        return `${(count / 1024).toFixed(1)} KB`;
    }
    return `${(count / 1024 / 1024).toFixed(2)} MB`;
}
