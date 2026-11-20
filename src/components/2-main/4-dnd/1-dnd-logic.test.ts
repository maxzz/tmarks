import { describe, it, expect } from "vitest";
import { type BookmarkFolder, type BookmarkLink, type BookmarkNodes } from "@/store/store/9-bookmark-types";
import { applyMove, normalizeDragIds, placementAt, planMove } from "./1-dnd-logic";

// Tree used by the tests:
//   A (folder)            top level
//     L2 (link)
//     C (folder)
//       L3 (link)
//   L1 (link)             top level
//   B (folder)            top level, empty

function folder(id: string, parentId: string | null, childIds: string[] = []): BookmarkFolder {
    return { kind: "folder", id, parentId, title: id, addDate: null, lastModified: null, childIds, isToolbar: false };
}

function link(id: string, parentId: string | null): BookmarkLink {
    return { kind: "link", id, parentId, title: id, addDate: null, lastModified: null, url: `https://${id}.example`, iconId: null };
}

function makeTree(): { nodes: BookmarkNodes; rootIds: string[]; } {
    const nodes: BookmarkNodes = {
        A: folder("A", null, ["L2", "C"]),
        L2: link("L2", "A"),
        C: folder("C", "A", ["L3"]),
        L3: link("L3", "C"),
        L1: link("L1", null),
        B: folder("B", null),
    };
    return { nodes, rootIds: ["A", "L1", "B"] };
}

function childrenOf(nodes: BookmarkNodes, id: string): string[] {
    const node = nodes[id];
    return node?.kind === "folder" ? node.childIds : [];
}

describe("placementAt", () => {
    it("puts a folder's top and bottom quarters before and after, and the middle inside", () => {
        expect(placementAt("folder", 0.1)).toBe("before");
        expect(placementAt("folder", 0.5)).toBe("into");
        expect(placementAt("folder", 0.9)).toBe("after");
    });

    it("splits a link in half", () => {
        expect(placementAt("link", 0.3)).toBe("before");
        expect(placementAt("link", 0.7)).toBe("after");
    });
});

describe("normalizeDragIds", () => {
    it("drops items that are inside another dragged folder, since they move with it", () => {
        const { nodes } = makeTree();
        expect(normalizeDragIds(nodes, ["L2", "A", "L3"])).toEqual(["A"]);
    });

    it("ignores unknown ids and duplicates", () => {
        const { nodes } = makeTree();
        expect(normalizeDragIds(nodes, ["L1", "L1", "missing"])).toEqual(["L1"]);
    });
});

describe("planMove", () => {
    it("refuses to move a folder into itself", () => {
        const { nodes } = makeTree();
        expect(planMove(nodes, ["A"], { kind: "into", folderId: "A" })).toBeNull();
    });

    it("refuses to move a folder into one of its own sub-folders", () => {
        const { nodes } = makeTree();
        expect(planMove(nodes, ["A"], { kind: "into", folderId: "C" })).toBeNull();
    });

    it("refuses to place an item before or after itself", () => {
        const { nodes } = makeTree();
        expect(planMove(nodes, ["L1"], { kind: "before", anchorId: "L1" })).toBeNull();
    });

    it("refuses a drop into something that is not a folder", () => {
        const { nodes } = makeTree();
        expect(planMove(nodes, ["L1"], { kind: "into", folderId: "L2" })).toBeNull();
    });
});

describe("applyMove", () => {
    it("moves a link into a folder and appends it there", () => {
        const { nodes, rootIds } = makeTree();
        const result = applyMove(nodes, rootIds, ["L1"], { kind: "into", folderId: "B" });

        expect(result).not.toBeNull();
        expect(result!.rootIds).toEqual(["A", "B"]);
        expect(childrenOf(result!.nodes, "B")).toEqual(["L1"]);
        expect(result!.nodes.L1.parentId).toBe("B");
    });

    it("moves an item after another item in the same folder", () => {
        const { nodes, rootIds } = makeTree();
        const result = applyMove(nodes, rootIds, ["L2"], { kind: "after", anchorId: "C" });

        expect(childrenOf(result!.nodes, "A")).toEqual(["C", "L2"]);
    });

    it("moves an item before another item in the same folder, after the removal shifts the indexes", () => {
        const { nodes, rootIds } = makeTree();
        const result = applyMove(nodes, rootIds, ["C"], { kind: "before", anchorId: "L2" });

        expect(childrenOf(result!.nodes, "A")).toEqual(["C", "L2"]);
    });

    it("moves a top-level item before a folder inside another folder", () => {
        const { nodes, rootIds } = makeTree();
        const result = applyMove(nodes, rootIds, ["L1"], { kind: "before", anchorId: "L3" });

        expect(result!.nodes.L1.parentId).toBe("C");
        expect(childrenOf(result!.nodes, "C")).toEqual(["L1", "L3"]);
        expect(result!.rootIds).toEqual(["A", "B"]);
    });

    it("appends to the top level when the container is the top level", () => {
        const { nodes, rootIds } = makeTree();
        const result = applyMove(nodes, rootIds, ["L2"], { kind: "end", parentId: null });

        expect(result!.rootIds).toEqual(["A", "L1", "B", "L2"]);
        expect(childrenOf(result!.nodes, "A")).toEqual(["C"]);
    });

    it("moves several items together, in the order given", () => {
        const { nodes, rootIds } = makeTree();
        const result = applyMove(nodes, rootIds, ["L1", "A"], { kind: "into", folderId: "B" });

        expect(result!.rootIds).toEqual(["B"]);
        expect(childrenOf(result!.nodes, "B")).toEqual(["L1", "A"]);
        expect(result!.nodes.A.parentId).toBe("B");
    });

    it("moves a folder with its contents, and leaves nested dragged items where they are", () => {
        const { nodes, rootIds } = makeTree();
        const result = applyMove(nodes, rootIds, ["A", "L2"], { kind: "into", folderId: "B" });

        expect(childrenOf(result!.nodes, "B")).toEqual(["A"]);
        expect(childrenOf(result!.nodes, "A")).toEqual(["L2", "C"]);
    });

    it("returns null for a drop that is not allowed", () => {
        const { nodes, rootIds } = makeTree();
        expect(applyMove(nodes, rootIds, ["A"], { kind: "into", folderId: "C" })).toBeNull();
    });
});
