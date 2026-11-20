import { describe, it, expect } from "vitest";
import { type BookmarkNodes } from "./9-bookmark-types";
import { selectionAfterClick, topmostIds, type SelectionState } from "./b-selection-logic";

const PLAIN = { ctrl: false, shift: false };
const CTRL = { ctrl: true, shift: false };
const SHIFT = { ctrl: false, shift: true };
const CTRL_SHIFT = { ctrl: true, shift: true };

const order = ["a", "b", "c", "d", "e"];
const none: SelectionState = { anchor: null, selected: new Set() };

function ids(state: SelectionState): string[] {
    return [...state.selected].sort();
}

describe("selectionAfterClick", () => {
    it("a plain click selects only the clicked item and makes it the anchor", () => {
        const state = selectionAfterClick({ anchor: "a", selected: new Set(["a", "b"]) }, order, "c", PLAIN);
        expect(ids(state)).toEqual(["c"]);
        expect(state.anchor).toBe("c");
    });

    it("Ctrl-click adds an item and keeps the others", () => {
        let state = selectionAfterClick(none, order, "a", PLAIN);
        state = selectionAfterClick(state, order, "c", CTRL);
        expect(ids(state)).toEqual(["a", "c"]);
        expect(state.anchor).toBe("c");
    });

    it("Ctrl-click on a selected item removes only that item", () => {
        let state = selectionAfterClick(none, order, "a", PLAIN);
        state = selectionAfterClick(state, order, "b", CTRL);
        state = selectionAfterClick(state, order, "a", CTRL);
        expect(ids(state)).toEqual(["b"]);
    });

    it("Shift-click selects the range from the anchor, in either direction", () => {
        const down = selectionAfterClick({ anchor: "b", selected: new Set(["b"]) }, order, "d", SHIFT);
        expect(ids(down)).toEqual(["b", "c", "d"]);

        const up = selectionAfterClick({ anchor: "d", selected: new Set(["d"]) }, order, "b", SHIFT);
        expect(ids(up)).toEqual(["b", "c", "d"]);
    });

    it("Shift-click replaces the selection with the range", () => {
        const state = selectionAfterClick({ anchor: "a", selected: new Set(["a", "e"]) }, order, "c", SHIFT);
        expect(ids(state)).toEqual(["a", "b", "c"]);
    });

    it("Shift-click keeps the anchor where it was, so the next Shift-click starts from the same item", () => {
        let state = selectionAfterClick(none, order, "b", PLAIN);
        state = selectionAfterClick(state, order, "d", SHIFT);
        expect(state.anchor).toBe("b");
        state = selectionAfterClick(state, order, "e", SHIFT);
        expect(ids(state)).toEqual(["b", "c", "d", "e"]);
    });

    it("Ctrl+Shift-click adds the range to the current selection", () => {
        let state = selectionAfterClick(none, order, "a", PLAIN);
        state = selectionAfterClick(state, order, "e", CTRL);
        state = selectionAfterClick(state, order, "c", CTRL);
        // Anchor is now "c". Ctrl+Shift-click on "d" adds c..d to what is already selected.
        state = selectionAfterClick(state, order, "d", CTRL_SHIFT);
        expect(ids(state)).toEqual(["a", "c", "d", "e"]);
    });

    it("Shift-click without a usable anchor works as a plain click", () => {
        const noAnchor = selectionAfterClick(none, order, "c", SHIFT);
        expect(ids(noAnchor)).toEqual(["c"]);
        expect(noAnchor.anchor).toBe("c");

        const anchorGone = selectionAfterClick({ anchor: "zz", selected: new Set(["zz"]) }, order, "b", SHIFT);
        expect(ids(anchorGone)).toEqual(["b"]);
    });

    it("does not change the list of items it is given", () => {
        const list = [...order];
        selectionAfterClick(none, list, "a", SHIFT);
        expect(list).toEqual(order);
    });
});

describe("topmostIds", () => {
    const nodes: BookmarkNodes = {
        F: { kind: "folder", id: "F", parentId: null, title: "F", addDate: 1, lastModified: 1, childIds: ["L"], isToolbar: false },
        L: { kind: "link", id: "L", parentId: "F", title: "L", addDate: 1, lastModified: 1, url: "https://l", iconId: null },
        M: { kind: "link", id: "M", parentId: null, title: "M", addDate: 1, lastModified: 1, url: "https://m", iconId: null },
    };

    it("drops an item that sits inside another given item", () => {
        expect(topmostIds(nodes, new Set(["F", "L", "M"])).sort()).toEqual(["F", "M"]);
    });

    it("drops ids that are not in the tree", () => {
        expect(topmostIds(nodes, new Set(["M", "missing"]))).toEqual(["M"]);
    });
});
