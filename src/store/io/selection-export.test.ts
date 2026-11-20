import { describe, it, expect } from "vitest";
import { type BookmarkDocument, type BookmarkFolder, type BookmarkLink, type BookmarkNodes } from "../store/9-bookmark-types";
import { exportFileName, selectionDocument } from "./selection-export";
import { serializeNetscapeBookmarks } from "./netscape-serialize";

// Tree used by the tests:
//   A (folder)                 top level
//     L2 (link, icon-1)
//     C (folder)
//       L3 (link)
//   L1 (link, icon-1)          top level
//   B (folder)                 top level, empty
//   D (folder)                 top level

function folder(id: string, parentId: string | null, childIds: string[] = []): BookmarkFolder {
    return { kind: "folder", id, parentId, title: id, addDate: 1, lastModified: 1, childIds, isToolbar: false };
}

function link(id: string, parentId: string | null, iconId: string | null = null): BookmarkLink {
    return { kind: "link", id, parentId, title: id, addDate: 1, lastModified: 1, url: `https://${id}.example`, iconId };
}

function makeDoc(): BookmarkDocument {
    const nodes: BookmarkNodes = {
        A: folder("A", null, ["L2", "C"]),
        L2: link("L2", "A", "icon-1"),
        C: folder("C", "A", ["L3"]),
        L3: link("L3", "C"),
        L1: link("L1", null, "icon-1"),
        B: folder("B", null),
        D: folder("D", null),
    };
    return { nodes, rootIds: ["A", "L1", "B", "D"], icons: { "icon-1": "data:image/png;base64,AAAA", "icon-unused": "data:image/png;base64,BBBB" } };
}

describe("selectionDocument", () => {
    it("keeps a selected folder with everything inside it", () => {
        const out = selectionDocument(makeDoc(), new Set(["C"]));

        expect(out.rootIds).toEqual(["C"]);
        expect(Object.keys(out.nodes).sort()).toEqual(["C", "L3"]);
        expect(out.nodes.C.parentId).toBeNull();
    });

    it("leaves out an item whose folder is also selected", () => {
        const out = selectionDocument(makeDoc(), new Set(["A", "L2", "C"]));

        expect(out.rootIds).toEqual(["A"]);
        expect(Object.keys(out.nodes).sort()).toEqual(["A", "C", "L2", "L3"]);
    });

    it("orders the items the way the tree shows them, not the order they were selected", () => {
        const out = selectionDocument(makeDoc(), new Set(["D", "L1", "A"]));

        expect(out.rootIds).toEqual(["A", "L1", "D"]);
    });

    it("keeps only the icons that the exported links use", () => {
        const out = selectionDocument(makeDoc(), new Set(["L2"]));
        expect(Object.keys(out.icons)).toEqual(["icon-1"]);

        const none = selectionDocument(makeDoc(), new Set(["B"]));
        expect(none.icons).toEqual({});
    });

    it("skips ids that are not in the tree", () => {
        const out = selectionDocument(makeDoc(), new Set(["L1", "gone"]));
        expect(out.rootIds).toEqual(["L1"]);
    });

    it("does not change the document it is given", () => {
        const doc = makeDoc();
        const before = JSON.stringify(doc);
        selectionDocument(doc, new Set(["A", "L1"]));
        expect(JSON.stringify(doc)).toBe(before);
    });

    it("writes a file that imports back with the same folders and links", () => {
        const html = serializeNetscapeBookmarks(selectionDocument(makeDoc(), new Set(["A", "L1"])), 100);

        expect(html).toContain('<DT><H3 ADD_DATE="1" LAST_MODIFIED="1">A</H3>');
        expect(html).toContain('<DT><A HREF="https://L2.example" ADD_DATE="1" LAST_MODIFIED="1" ICON="data:image/png;base64,AAAA">L2</A>');
        expect(html).toContain('<DT><A HREF="https://L3.example" ADD_DATE="1" LAST_MODIFIED="1">L3</A>');
        expect(html).toContain('<DT><A HREF="https://L1.example" ADD_DATE="1" LAST_MODIFIED="1" ICON="data:image/png;base64,AAAA">L1</A>');
        expect(html).not.toContain(">B</H3>");
    });
});

describe("exportFileName", () => {
    it("names a single exported item after its title", () => {
        const out = selectionDocument(makeDoc(), new Set(["A"]));
        expect(exportFileName(out, "2026-11-20")).toBe("A.html");
    });

    it("uses a dated name for several items", () => {
        const out = selectionDocument(makeDoc(), new Set(["A", "L1"]));
        expect(exportFileName(out, "2026-11-20")).toBe("bookmarks-2026-11-20.html");
    });

    it("replaces characters that cannot be used in a file name", () => {
        const doc = makeDoc();
        doc.nodes.B = { ...doc.nodes.B, title: "a/b:c?" };
        expect(exportFileName(selectionDocument(doc, new Set(["B"])), "2026-11-20")).toBe("a_b_c_.html");
    });

    it("falls back to the dated name when the title is empty", () => {
        const doc = makeDoc();
        doc.nodes.B = { ...doc.nodes.B, title: "   " };
        expect(exportFileName(selectionDocument(doc, new Set(["B"])), "2026-11-20")).toBe("bookmarks-2026-11-20.html");
    });
});
