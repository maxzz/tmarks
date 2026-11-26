import { describe, it, expect } from "vitest";
import { type BookmarkDocument, type BookmarkFolder, type BookmarkLink } from "@/store/store/9-bookmark-types";
import { selectionDocument } from "@/store/io/selection-export";
import { initialViewOf, insertFragment, mergeIcons, pruneView, removeItems, resolvePlacement, shownFolderIdOf, tabHeaderPlacement } from "./0-tabs-logic";

// Source tab:            Target tab:
//   A (folder)             T (folder)
//     L1 (link, icon-1)      T1 (link)
//     C (folder)           U (folder, empty)
//       L2 (link)
//   B (folder, empty)

function folder(id: string, parentId: string | null, childIds: string[] = []): BookmarkFolder {
    return { kind: "folder", id, parentId, title: id, addDate: 1, lastModified: 1, childIds, isToolbar: false };
}

function link(id: string, parentId: string | null, iconId: string | null = null): BookmarkLink {
    return { kind: "link", id, parentId, title: id, addDate: 1, lastModified: 1, url: `https://${id}.example`, iconId };
}

function sourceDoc(): BookmarkDocument {
    return {
        nodes: {
            A: folder("A", null, ["L1", "C"]),
            L1: link("L1", "A", "icon-1"),
            C: folder("C", "A", ["L2"]),
            L2: link("L2", "C"),
            B: folder("B", null),
        },
        rootIds: ["A", "B"],
        icons: { "icon-1": "data:image/png;base64,AAA" },
    };
}

function targetDoc(): BookmarkDocument {
    return {
        nodes: {
            T: folder("T", null, ["T1"]),
            T1: link("T1", "T"),
            U: folder("U", null),
        },
        rootIds: ["T", "U"],
        icons: {},
    };
}

function idMaker() {
    let n = 0;
    return () => `n${++n}`;
}

describe("insertFragment", () => {
    it("inserts copies with new ids at the end of a folder, with their icons", () => {
        const fragment = selectionDocument(sourceDoc(), new Set(["L1"]));
        const result = insertFragment(targetDoc(), fragment, { kind: "end", parentId: "T" }, null, idMaker());

        expect(result!.newIds).toEqual(["n1"]);
        const T = result!.doc.nodes.T;
        expect(T.kind === "folder" && T.childIds).toEqual(["T1", "n1"]);
        expect(result!.doc.nodes.n1.parentId).toBe("T");
        expect(result!.doc.icons["icon-1"]).toBe("data:image/png;base64,AAA");
    });

    it("copies a folder with everything inside it", () => {
        const fragment = selectionDocument(sourceDoc(), new Set(["C"]));
        const result = insertFragment(targetDoc(), fragment, { kind: "into", folderId: "U" }, null, idMaker());

        const copy = result!.doc.nodes.n1;
        expect(copy.kind).toBe("folder");
        expect(copy.parentId).toBe("U");
        const child = copy.kind === "folder" ? result!.doc.nodes[copy.childIds[0]] : undefined;
        expect(child?.parentId).toBe("n1");
        expect(child?.kind === "link" && child.url).toBe("https://L2.example");
    });

    it("places items before and after an anchor", () => {
        const fragment = selectionDocument(sourceDoc(), new Set(["B"]));
        const before = insertFragment(targetDoc(), fragment, { kind: "before", anchorId: "U" }, null, idMaker());
        const after = insertFragment(targetDoc(), fragment, { kind: "after", anchorId: "T1" }, null, idMaker());

        expect(before!.doc.rootIds).toEqual(["T", "n1", "U"]);
        const T = after!.doc.nodes.T;
        expect(T.kind === "folder" && T.childIds).toEqual(["T1", "n1"]);
    });

    it("keeps the dates for a move and sets them for a copy", () => {
        const fragment = selectionDocument(sourceDoc(), new Set(["L1"]));
        const moved = insertFragment(targetDoc(), fragment, { kind: "end", parentId: "U" }, null, idMaker());
        const copied = insertFragment(targetDoc(), fragment, { kind: "end", parentId: "U" }, 99, idMaker());

        expect(moved!.doc.nodes.n1.addDate).toBe(1);
        expect(copied!.doc.nodes.n1.addDate).toBe(99);
    });

    it("leaves the target unchanged", () => {
        const target = targetDoc();
        insertFragment(target, selectionDocument(sourceDoc(), new Set(["A"])), { kind: "end", parentId: null }, null, idMaker());
        expect(target).toEqual(targetDoc());
    });

    it("refuses a place that is not in the target", () => {
        const fragment = selectionDocument(sourceDoc(), new Set(["L1"]));
        expect(insertFragment(targetDoc(), fragment, { kind: "into", folderId: "A" }, null, idMaker())).toBeNull();
        expect(insertFragment(targetDoc(), fragment, { kind: "into", folderId: "T1" }, null, idMaker())).toBeNull();
    });

    it("refuses an empty fragment", () => {
        const fragment = selectionDocument(sourceDoc(), new Set(["missing"]));
        expect(insertFragment(targetDoc(), fragment, { kind: "end", parentId: null }, null, idMaker())).toBeNull();
    });
});

describe("removeItems", () => {
    it("removes items with everything inside them, and the icons no longer used", () => {
        const result = removeItems(sourceDoc(), ["A"]);
        expect(result.rootIds).toEqual(["B"]);
        expect(Object.keys(result.nodes)).toEqual(["B"]);
        expect(result.icons).toEqual({});
    });

    it("removes a nested item from its folder", () => {
        const result = removeItems(sourceDoc(), ["C", "L2"]);
        const A = result.nodes.A;
        expect(A.kind === "folder" && A.childIds).toEqual(["L1"]);
        expect(result.nodes.L2).toBeUndefined();
        expect(result.icons["icon-1"]).toBeDefined();
    });
});

describe("resolvePlacement", () => {
    it("finds the parent and position of each kind of placement", () => {
        const doc = targetDoc();
        expect(resolvePlacement(doc, { kind: "end", parentId: null })).toEqual({ parentId: null, index: 2 });
        expect(resolvePlacement(doc, { kind: "into", folderId: "T" })).toEqual({ parentId: "T", index: 1 });
        expect(resolvePlacement(doc, { kind: "before", anchorId: "T1" })).toEqual({ parentId: "T", index: 0 });
        expect(resolvePlacement(doc, { kind: "after", anchorId: "U" })).toEqual({ parentId: null, index: 2 });
        expect(resolvePlacement(doc, { kind: "after", anchorId: "missing" })).toBeNull();
    });
});

describe("tabHeaderPlacement", () => {
    const { nodes } = targetDoc();

    it("drops into the folder the tab shows", () => {
        expect(tabHeaderPlacement("T", nodes, ["link"])).toEqual({ kind: "end", parentId: "T" });
    });

    it("drops folders at the top level when the tab shows no folder", () => {
        expect(tabHeaderPlacement(null, nodes, ["folder", "folder"])).toEqual({ kind: "end", parentId: null });
    });

    it("refuses links when the tab shows no folder, since the top level lists only folders", () => {
        expect(tabHeaderPlacement(null, nodes, ["folder", "link"])).toBeNull();
    });
});

describe("views", () => {
    it("opens the top-level folders, and selects a sole top-level folder", () => {
        const one: BookmarkDocument = { nodes: { A: folder("A", null) }, rootIds: ["A"], icons: {} };
        expect(initialViewOf(one).treeSelectedId).toBe("A");
        expect([...initialViewOf(one).expandedIds]).toEqual(["A"]);
        expect(initialViewOf(targetDoc()).treeSelectedId).toBeNull();
    });

    it("finds the folder a hidden tab shows", () => {
        const view = initialViewOf(targetDoc());
        expect(shownFolderIdOf({ ...view, treeSelectedId: "T" }, targetDoc().nodes)).toBe("T");
        expect(shownFolderIdOf({ ...view, selectionPanel: "items", itemSelectedId: "T1" }, targetDoc().nodes)).toBe("T");
        expect(shownFolderIdOf({ ...view, treeSelectedId: "T", pinnedFolder: { id: "U" } }, targetDoc().nodes)).toBe("U");
        expect(shownFolderIdOf(view, targetDoc().nodes)).toBeNull();
    });

    it("drops selected ids that are gone, and keeps the view itself when none are", () => {
        const view = { ...initialViewOf(targetDoc()), itemSelectedId: "T1", itemSelectedIds: new Set(["T1"]) };
        expect(pruneView(view, targetDoc().nodes)).toBe(view);

        const pruned = pruneView(view, removeItems(targetDoc(), ["T1"]).nodes);
        expect(pruned.itemSelectedId).toBeNull();
        expect(pruned.itemSelectedIds.size).toBe(0);
    });
});

describe("mergeIcons", () => {
    it("returns the only filled cache itself", () => {
        const icons = { a: "1" };
        expect(mergeIcons([{}, icons, {}])).toBe(icons);
    });

    it("returns the first cache when it already has every icon", () => {
        const all = { a: "1", b: "2" };
        expect(mergeIcons([all, { b: "2" }])).toBe(all);
    });

    it("joins caches with different icons", () => {
        expect(mergeIcons([{ a: "1" }, { b: "2" }])).toEqual({ a: "1", b: "2" });
    });
});
