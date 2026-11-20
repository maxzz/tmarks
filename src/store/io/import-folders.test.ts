import { describe, it, expect } from "vitest";
import { type BookmarkDocument, type BookmarkFolder, type BookmarkLink, type BookmarkNodes } from "../store/9-bookmark-types";
import { importedFolderTitle, wrapTopLevelLinks } from "./import-folders";

function folder(id: string, parentId: string | null, childIds: string[] = []): BookmarkFolder {
    return { kind: "folder", id, parentId, title: id, addDate: 1, lastModified: 1, childIds, isToolbar: false };
}

function link(id: string, parentId: string | null, iconId: string | null = null): BookmarkLink {
    return { kind: "link", id, parentId, title: id, addDate: 1, lastModified: 1, url: `https://${id}.example`, iconId };
}

/** Gives the new folders readable ids: n1, n2, ... */
function idMaker() {
    let n = 0;
    return () => `n${++n}`;
}

describe("importedFolderTitle", () => {
    it("drops the .html extension", () => {
        expect(importedFolderTitle("links.html")).toBe("links");
        expect(importedFolderTitle("Links.HTM")).toBe("Links");
    });

    it("falls back when nothing is left of the name", () => {
        expect(importedFolderTitle(".html")).toBe("Imported bookmarks");
    });
});

describe("wrapTopLevelLinks", () => {
    it("puts a file of loose links into one folder named after the file", () => {
        const doc: BookmarkDocument = {
            nodes: { L1: link("L1", null, "icon-1"), L2: link("L2", null) },
            rootIds: ["L1", "L2"],
            icons: { "icon-1": "data:image/png;base64,AAAA" },
        };

        const out = wrapTopLevelLinks(doc, "links", 100, idMaker());

        expect(out.rootIds).toEqual(["n1"]);
        const folderNode = out.nodes.n1;
        expect(folderNode.kind === "folder" && folderNode.title).toBe("links");
        expect(folderNode.kind === "folder" && folderNode.childIds).toEqual(["L1", "L2"]);
        expect(folderNode.kind === "folder" && folderNode.isToolbar).toBe(false);
        expect(folderNode.addDate).toBe(100);
        expect(out.nodes.L1.parentId).toBe("n1");
        expect(out.nodes.L2.parentId).toBe("n1");
        expect(out.icons).toBe(doc.icons);
    });

    it("keeps the folders of a mixed file, and puts the folder for the links after them", () => {
        const doc: BookmarkDocument = {
            nodes: {
                F: folder("F", null, ["L3"]),
                L3: link("L3", "F"),
                L1: link("L1", null),
            },
            rootIds: ["F", "L1"],
            icons: {},
        };

        const out = wrapTopLevelLinks(doc, "mixed", 100, idMaker());

        expect(out.rootIds).toEqual(["F", "n1"]);
        expect(out.nodes.F.parentId).toBeNull();
        expect(out.nodes.L3.parentId).toBe("F");
        expect(out.nodes.n1.kind === "folder" && out.nodes.n1.childIds).toEqual(["L1"]);
    });

    it("returns a file that has only folders unchanged", () => {
        const doc: BookmarkDocument = {
            nodes: { F: folder("F", null) },
            rootIds: ["F"],
            icons: {},
        };
        expect(wrapTopLevelLinks(doc, "folders", 100, idMaker())).toBe(doc);
    });

    it("does not change the document it is given", () => {
        const nodes: BookmarkNodes = { L1: link("L1", null) };
        const doc: BookmarkDocument = { nodes, rootIds: ["L1"], icons: {} };

        wrapTopLevelLinks(doc, "links", 100, idMaker());

        expect(doc.rootIds).toEqual(["L1"]);
        expect(doc.nodes.L1.parentId).toBeNull();
    });
});
