import { describe, it, expect } from "vitest";
import { type BookmarkFolder, type BookmarkLink, type BookmarkNodes } from "../store/9-bookmark-types";
import { parseViewState, pruneViewState, restoredViewState } from "./0-view-state-logic";

// Tree used by the tests:
//   A (folder)     top level
//     C (folder)
//       L3 (link)
//   L1 (link)      top level
//   B (folder)     top level

function folder(id: string, parentId: string | null, childIds: string[] = []): BookmarkFolder {
    return { kind: "folder", id, parentId, title: id, addDate: 1, lastModified: 1, childIds, isToolbar: false };
}

function link(id: string, parentId: string | null): BookmarkLink {
    return { kind: "link", id, parentId, title: id, addDate: 1, lastModified: 1, url: `https://${id}.example`, iconId: null };
}

function makeNodes(): BookmarkNodes {
    return {
        A: folder("A", null, ["C"]),
        C: folder("C", "A", ["L3"]),
        L3: link("L3", "C"),
        L1: link("L1", null),
        B: folder("B", null),
    };
}

describe("parseViewState", () => {
    it("accepts a saved view", () => {
        expect(parseViewState({ expandedIds: ["A"], selectedId: "C" })).toEqual({ expandedIds: ["A"], selectedId: "C" });
        expect(parseViewState({ expandedIds: [], selectedId: null })).toEqual({ expandedIds: [], selectedId: null });
    });

    it("rejects anything else", () => {
        expect(parseViewState(null)).toBeNull();
        expect(parseViewState("A")).toBeNull();
        expect(parseViewState({ expandedIds: "A", selectedId: null })).toBeNull();
        expect(parseViewState({ expandedIds: [1], selectedId: null })).toBeNull();
        expect(parseViewState({ expandedIds: [], selectedId: 5 })).toBeNull();
        expect(parseViewState({ expandedIds: [] })).toBeNull();
    });
});

describe("pruneViewState", () => {
    it("drops ids that are no longer in the tree", () => {
        const out = pruneViewState({ expandedIds: ["A", "gone"], selectedId: "gone" }, makeNodes());
        expect(out).toEqual({ expandedIds: ["A"], selectedId: null });
    });

    it("drops links, since only folders can be open or selected in the tree", () => {
        const out = pruneViewState({ expandedIds: ["L1", "A"], selectedId: "L3" }, makeNodes());
        expect(out).toEqual({ expandedIds: ["A"], selectedId: null });
    });

    it("removes duplicate ids", () => {
        const out = pruneViewState({ expandedIds: ["A", "A", "C"], selectedId: "C" }, makeNodes());
        expect(out.expandedIds).toEqual(["A", "C"]);
    });
});

describe("restoredViewState", () => {
    it("opens the top-level folders when nothing was saved", () => {
        expect(restoredViewState(null, makeNodes(), ["A", "L1", "B"])).toEqual({ expandedIds: ["A", "B"], selectedId: null });
    });

    it("uses the saved view, pruned to the current tree", () => {
        const saved = { expandedIds: ["A", "C", "gone"], selectedId: "C" };
        expect(restoredViewState(saved, makeNodes(), ["A", "L1", "B"])).toEqual({ expandedIds: ["A", "C"], selectedId: "C" });
    });

    it("keeps a saved view where every folder was closed", () => {
        expect(restoredViewState({ expandedIds: [], selectedId: null }, makeNodes(), ["A"])).toEqual({ expandedIds: [], selectedId: null });
    });
});
