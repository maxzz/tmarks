import { describe, it, expect } from "vitest";
import { type BookmarkFolder, type BookmarkLink, type BookmarkNodes } from "@/store/store/9-bookmark-types";
import { copyNodes } from "./0-clipboard-logic";

// Tree used by the tests:
//   A (folder, isToolbar)     top level
//     L2 (link)
//     C (folder)
//       L3 (link)
//   L1 (link)                 top level
//   B (folder)                top level, empty

function folder(id: string, parentId: string | null, childIds: string[] = [], isToolbar = false): BookmarkFolder {
    return { kind: "folder", id, parentId, title: id, addDate: 1, lastModified: 1, childIds, isToolbar };
}

function link(id: string, parentId: string | null, iconId: string | null = null): BookmarkLink {
    return { kind: "link", id, parentId, title: id, addDate: 1, lastModified: 1, url: `https://${id}.example`, iconId };
}

function makeTree(): { nodes: BookmarkNodes; rootIds: string[]; } {
    const nodes: BookmarkNodes = {
        A: folder("A", null, ["L2", "C"], true),
        L2: link("L2", "A", "icon-1"),
        C: folder("C", "A", ["L3"]),
        L3: link("L3", "C"),
        L1: link("L1", null, "icon-1"),
        B: folder("B", null),
    };
    return { nodes, rootIds: ["A", "L1", "B"] };
}

/** Gives copies readable ids: n1, n2, ... */
function idMaker() {
    let n = 0;
    return () => `n${++n}`;
}

describe("copyNodes", () => {
    it("copies a link into a folder with a new id and keeps its url and icon", () => {
        const { nodes, rootIds } = makeTree();
        const result = copyNodes(nodes, rootIds, ["L1"], "B", 99, idMaker());

        expect(result).not.toBeNull();
        expect(result!.newIds).toEqual(["n1"]);
        const copy = result!.nodes.n1;
        expect(copy.kind === "link" && copy.url).toBe("https://L1.example");
        expect(copy.kind === "link" && copy.iconId).toBe("icon-1");
        expect(copy.parentId).toBe("B");
        expect(result!.nodes.B.kind === "folder" && result!.nodes.B.childIds).toEqual(["n1"]);
    });

    it("leaves the original items where they were", () => {
        const { nodes, rootIds } = makeTree();
        const result = copyNodes(nodes, rootIds, ["L1"], "B", 99, idMaker());

        expect(result!.rootIds).toEqual(["A", "L1", "B"]);
        expect(result!.nodes.L1).toBe(nodes.L1);
    });

    it("copies a folder with everything inside it, giving every copy a new id", () => {
        const { nodes, rootIds } = makeTree();
        const result = copyNodes(nodes, rootIds, ["C"], null, 99, idMaker());

        const copyC = result!.nodes[result!.newIds[0]];
        expect(copyC.kind).toBe("folder");
        expect(copyC.parentId).toBeNull();
        expect(result!.rootIds).toEqual(["A", "L1", "B", "n1"]);
        const childCopy = copyC.kind === "folder" ? result!.nodes[copyC.childIds[0]] : undefined;
        expect(childCopy?.parentId).toBe("n1");
        expect(childCopy?.kind === "link" && childCopy.url).toBe("https://L3.example");
        expect(copyC.kind === "folder" && copyC.childIds[0]).not.toBe("L3");
    });

    it("does not carry the bookmarks-bar flag over to a copied folder", () => {
        const { nodes, rootIds } = makeTree();
        const result = copyNodes(nodes, rootIds, ["A"], "B", 99, idMaker());

        const copy = result!.nodes[result!.newIds[0]];
        expect(copy.kind === "folder" && copy.isToolbar).toBe(false);
        expect(nodes.A.kind === "folder" && nodes.A.isToolbar).toBe(true);
    });

    it("copies only the top-most item when a folder and its child are both given", () => {
        const { nodes, rootIds } = makeTree();
        const result = copyNodes(nodes, rootIds, ["L3", "C"], "B", 99, idMaker());

        expect(result!.newIds).toHaveLength(1);
        expect(result!.nodes.B.kind === "folder" && result!.nodes.B.childIds).toEqual(["n1"]);
    });

    it("refuses to copy a folder into itself or into one of its sub-folders", () => {
        const { nodes, rootIds } = makeTree();
        expect(copyNodes(nodes, rootIds, ["A"], "A", 99, idMaker())).toBeNull();
        expect(copyNodes(nodes, rootIds, ["A"], "C", 99, idMaker())).toBeNull();
    });

    it("refuses a target that is not a folder", () => {
        const { nodes, rootIds } = makeTree();
        expect(copyNodes(nodes, rootIds, ["L1"], "L2", 99, idMaker())).toBeNull();
    });

    it("returns null when none of the ids exist", () => {
        const { nodes, rootIds } = makeTree();
        expect(copyNodes(nodes, rootIds, ["missing"], null, 99, idMaker())).toBeNull();
    });
});
