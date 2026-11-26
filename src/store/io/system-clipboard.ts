import { type BookmarkDocument, type BookmarkId } from "../store/9-bookmark-types";

// Copy and Cut also put the items on the system clipboard, so they can be pasted into other apps: as a nested list
// of links for editors that take HTML, and as one URL per line for plain text. Icons are left out, since inline
// images would make the clipboard very large. Paste inside the app does not read the system clipboard.

/** The items as a nested HTML list: folders are list items with their own list, links are anchors. */
export function clipboardHtml(doc: BookmarkDocument): string {
    const list = (ids: BookmarkId[]): string => {
        const items = ids.map((id) => {
            const node = doc.nodes[id];
            if (!node) {
                return "";
            }
            if (node.kind === "link") {
                return `<li><a href="${escapeHtml(node.url)}">${escapeHtml(node.title || node.url)}</a></li>`;
            }
            return `<li>${escapeHtml(node.title)}${node.childIds.length > 0 ? list(node.childIds) : ""}</li>`;
        });
        return `<ul>${items.join("")}</ul>`;
    };
    return list(doc.rootIds);
}

/** The URLs of all links in the items, folders included, in tree order, one per line. */
export function clipboardText(doc: BookmarkDocument): string {
    const urls: string[] = [];
    const visit = (id: BookmarkId) => {
        const node = doc.nodes[id];
        if (node?.kind === "link") {
            urls.push(node.url);
        } else if (node) {
            node.childIds.forEach(visit);
        }
    };
    doc.rootIds.forEach(visit);
    return urls.join("\n");
}

/** Writes the items to the system clipboard. Failures are only logged: the app's own clipboard still has the items. */
export function writeSystemClipboard(doc: BookmarkDocument): void {
    if (doc.rootIds.length === 0 || !navigator.clipboard) {
        return;
    }

    const html = clipboardHtml(doc);
    const text = clipboardText(doc);
    const written = typeof ClipboardItem !== "undefined" && navigator.clipboard.write
        ? navigator.clipboard.write([new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
        })])
        : navigator.clipboard.writeText(text);
    written.catch((e: unknown) => console.warn("Failed to write the system clipboard", e));
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
