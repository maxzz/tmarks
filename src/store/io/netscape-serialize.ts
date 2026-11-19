import { type BookmarkDocument, type BookmarkId, type BookmarkNodes } from "../store/9-bookmark-types";

/**
 * Writes a document in the Netscape Bookmark File Format, the same layout Chrome and Opera export.
 * Browsers import this file with their "Import bookmarks from HTML" feature.
 *
 * File layout:
 *
 * ```
 * <!DOCTYPE NETSCAPE-Bookmark-file-1>             ┐
 * <!-- This is an automatically generated ... --> │ header
 * <META HTTP-EQUIV="Content-Type" ...>            │
 * <TITLE>Bookmarks</TITLE>                        │
 * <H1>Bookmarks</H1>                              ┘
 * <DL><p>                                                  ← root list opens
 *     <DT><H3 ADD_DATE="…" LAST_MODIFIED="…">Folder</H3>   ← folder entry
 *     <DL><p>                                              ← folder's child list opens
 *         <DT><A HREF="…" ADD_DATE="…" ICON="…">Title</A>  ← link entry
 *         <DT><H3 …>Subfolder</H3>                         ← folders nest recursively
 *         <DL><p> … </DL><p>
 *     </DL><p>                                             ← folder's child list closes
 * </DL><p>                                                 ← root list closes
 * ```
 *
 * Tree → markup:
 *   folder  →  <DT><H3 attrs>title</H3>  <DL><p> children… </DL><p>
 *   link    →  <DT><A HREF attrs>title</A>
 *
 * Dates are Unix seconds. Indentation is 4 spaces per depth level (cosmetic only).
 */

export function serializeNetscapeBookmarks(doc: BookmarkDocument, nowSeconds: number = Math.floor(Date.now() / 1000)): string {
    const lines: string[] = [
        "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
        "<!-- This is an automatically generated file.",
        "     It will be read and overwritten.",
        "     DO NOT EDIT! -->",
        '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
        "<TITLE>Bookmarks</TITLE>",
        "<H1>Bookmarks</H1>",
        "<DL><p>",
    ];

    for (const id of doc.rootIds) {
        writeNode(lines, doc.nodes, id, 1, nowSeconds);
    }

    lines.push("</DL><p>");
    return lines.join("\n") + "\n";
}

function writeNode(lines: string[], nodes: BookmarkNodes, id: BookmarkId, depth: number, nowSeconds: number): void {
    const node = nodes[id];
    if (!node) {
        return;
    }

    const indent = "    ".repeat(depth);
    const dates = [`ADD_DATE="${node.addDate ?? nowSeconds}"`];
    if (node.lastModified !== null) {
        dates.push(`LAST_MODIFIED="${node.lastModified}"`);
    }

    if (node.kind === "folder") {
        const attributes = [...dates];
        if (node.isToolbar) {
            attributes.push('PERSONAL_TOOLBAR_FOLDER="true"');
        }

        lines.push(`${indent}<DT><H3 ${attributes.join(" ")}>${escapeHtml(node.title)}</H3>`);
        lines.push(`${indent}<DL><p>`);

        for (const childId of node.childIds) {
            writeNode(lines, nodes, childId, depth + 1, nowSeconds);
        }
        
        lines.push(`${indent}</DL><p>`);
        return;
    }

    const attributes = [`HREF="${escapeHtml(node.url)}"`, ...dates];
    if (node.icon) {
        attributes.push(`ICON="${escapeHtml(node.icon)}"`);
    }

    lines.push(`${indent}<DT><A ${attributes.join(" ")}>${escapeHtml(node.title)}</A>`);
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
