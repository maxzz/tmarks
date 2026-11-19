import { uuid } from "@/utils/uuid";
import { type BookmarkDocument, type BookmarkFolder, type BookmarkId, type BookmarkLink, type BookmarkNodes } from "../store/9-bookmark-types";

/**
 * Reads the Netscape Bookmark File Format ("NETSCAPE-Bookmark-file-1") that Chrome and Opera
 * (Chromium-based) export. The format is HTML-like but its tags are not closed (<DT>, <DL>, <P>),
 * so the browser's own HTML parser is used and the tree is read from the resulting DOM.
 *
 * Format summary (publicly documented by Netscape/Mozilla; Chromium's bookmark_html_writer.cc writes the same):
 *   <DT><H3 ADD_DATE="s" LAST_MODIFIED="s" PERSONAL_TOOLBAR_FOLDER="true">Folder</H3>
 *   <DL><p> ...children... </DL><p>
 *   <DT><A HREF="url" ADD_DATE="s" LAST_MODIFIED="s" ICON="data:image/png;base64,...">Title</A>
 * Dates are Unix time in seconds.
 */
export function parseNetscapeBookmarks(html: string): BookmarkDocument {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const nodes: BookmarkNodes = {};
    const rootIds = readItems(doc.body, null, nodes);
    return { nodes, rootIds };
}

/** Reads the items of one list (`<DL>`), recursing into wrappers the HTML parser may have created around them. */
function readItems(container: Element, parentId: BookmarkId | null, nodes: BookmarkNodes): BookmarkId[] {
    const ids: BookmarkId[] = [];
    const children = Array.from(container.children);

    for (let i = 0; i < children.length; i++) {
        const el = children[i];

        if (el.tagName === "DL" || el.tagName === "P") {
            ids.push(...readItems(el, parentId, nodes));
            continue;
        }

        if (el.tagName !== "DT") {
            continue; // H1, TITLE, DD (comments), etc.
        }

        const h3 = findChild(el, "H3");
        if (h3) {
            const folderId = uuid();

            // The sub-list is normally nested inside the <DT>; some exporters put it as the next sibling instead.
            let subList = findChild(el, "DL");
            const next = children[i + 1];
            if (!subList && next?.tagName === "DL") {
                subList = next;
                i++;
            }

            const folder: BookmarkFolder = {
                kind: "folder",
                id: folderId,
                parentId,
                title: textOf(h3),
                addDate: readSeconds(h3, "ADD_DATE"),
                lastModified: readSeconds(h3, "LAST_MODIFIED"),
                isToolbar: h3.getAttribute("PERSONAL_TOOLBAR_FOLDER")?.toLowerCase() === "true",
                childIds: [],
            };
            nodes[folderId] = folder;
            folder.childIds = subList ? readItems(subList, folderId, nodes) : [];
            ids.push(folderId);
            continue;
        }

        const a = findChild(el, "A");
        if (a) {
            const linkId = uuid();
            const icon = a.getAttribute("ICON");
            const link: BookmarkLink = {
                kind: "link",
                id: linkId,
                parentId,
                title: textOf(a),
                url: a.getAttribute("HREF") ?? "",
                addDate: readSeconds(a, "ADD_DATE"),
                lastModified: readSeconds(a, "LAST_MODIFIED"),
                icon: icon?.startsWith("data:image/") ? icon : null,
            };
            nodes[linkId] = link;
            ids.push(linkId);
        }
    }

    return ids;
}

function findChild(parent: Element, tagName: string): Element | undefined {
    return Array.from(parent.children).find((child) => child.tagName === tagName);
}

function textOf(el: Element): string {
    return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function readSeconds(el: Element, attribute: string): number | null {
    const value = Number.parseInt(el.getAttribute(attribute) ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : null;
}
