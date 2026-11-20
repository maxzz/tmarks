import { describe, it, expect } from "vitest";
import { type BookmarkFolder, type BookmarkLink, type BookmarkNodes } from "@/store/store/9-bookmark-types";
import {
    historyCommandOf,
    isSameTree,
    keepExistingId,
    keepExistingIds,
    MAX_HISTORY_STEPS,
    pickReferencedIcons,
    pushStep,
    type HistorySnapshot,
} from "./0-history-logic";

// Tree used by the tests:
//   A (folder)            top level
//     L1 (link, icon-1)
//   L2 (link, no icon)    top level

function folder(id: string, parentId: string | null, childIds: string[] = []): BookmarkFolder {
    return { kind: "folder", id, parentId, title: id, addDate: 1, lastModified: 1, childIds, isToolbar: false };
}

function link(id: string, parentId: string | null, iconId: string | null = null): BookmarkLink {
    return { kind: "link", id, parentId, title: id, addDate: 1, lastModified: 1, url: `https://${id}.example`, iconId };
}

function makeSnapshot(): HistorySnapshot {
    return {
        nodes: {
            A: folder("A", null, ["L1"]),
            L1: link("L1", "A", "icon-1"),
            L2: link("L2", null),
        },
        rootIds: ["A", "L2"],
        icons: { "icon-1": "data:image/png;base64,AAA", "icon-2": "data:image/png;base64,BBB" },
    };
}

describe("isSameTree", () => {
    it("is true for the same snapshot", () => {
        const snap = makeSnapshot();
        expect(isSameTree(snap, snap)).toBe(true);
    });

    it("is true when only the icons differ", () => {
        const snap = makeSnapshot();
        expect(isSameTree(snap, { ...snap, icons: {} })).toBe(true);
    });

    it("is false when one node changes", () => {
        const snap = makeSnapshot();
        const nodes = { ...snap.nodes, L2: { ...snap.nodes.L2, title: "renamed" } };
        expect(isSameTree(snap, { ...snap, nodes })).toBe(false);
    });

    it("is false when a node is removed", () => {
        const snap = makeSnapshot();
        const { L2: _removed, ...nodes } = snap.nodes;
        expect(isSameTree(snap, { ...snap, nodes, rootIds: ["A"] })).toBe(false);
    });

    it("is false when the top level order changes", () => {
        const snap = makeSnapshot();
        expect(isSameTree(snap, { ...snap, rootIds: ["L2", "A"] })).toBe(false);
    });

    it("is true for a new record that holds the same node objects", () => {
        const snap = makeSnapshot();
        const copy: HistorySnapshot = { ...snap, nodes: { ...snap.nodes }, rootIds: [...snap.rootIds] };
        expect(isSameTree(snap, copy)).toBe(true);
    });
});

describe("pickReferencedIcons", () => {
    it("keeps only the icons that a link refers to", () => {
        const snap = makeSnapshot();
        expect(pickReferencedIcons(snap.nodes, snap.icons)).toEqual({ "icon-1": "data:image/png;base64,AAA" });
    });

    it("keeps nothing when no link refers to an icon", () => {
        const snap = makeSnapshot();
        expect(pickReferencedIcons({ L2: snap.nodes.L2 }, snap.icons)).toEqual({});
    });
});

describe("pushStep", () => {
    it("adds the step at the end without changing the old stack", () => {
        const first = makeSnapshot();
        const second = { ...makeSnapshot(), rootIds: [] };
        const stack = pushStep([first], second);
        expect(stack).toEqual([first, second]);
    });

    it("keeps only the newest MAX_HISTORY_STEPS steps", () => {
        let stack: HistorySnapshot[] = [];
        const steps = Array.from({ length: MAX_HISTORY_STEPS + 5 }, (_, i) => ({ ...makeSnapshot(), rootIds: [`step-${i}`] }));
        for (const step of steps) {
            stack = pushStep(stack, step);
        }
        expect(stack).toHaveLength(MAX_HISTORY_STEPS);
        expect(stack[0]).toBe(steps[5]);
        expect(stack[stack.length - 1]).toBe(steps[steps.length - 1]);
    });
});

describe("selection helpers", () => {
    const nodes: BookmarkNodes = makeSnapshot().nodes;

    it("keeps an id that still exists and drops one that does not", () => {
        expect(keepExistingId("L1", nodes)).toBe("L1");
        expect(keepExistingId("gone", nodes)).toBeNull();
        expect(keepExistingId(null, nodes)).toBeNull();
    });

    it("returns the same set when every id exists", () => {
        const ids = new Set(["A", "L2"]);
        expect(keepExistingIds(ids, nodes)).toBe(ids);
    });

    it("returns only the existing ids when some are missing", () => {
        const kept = keepExistingIds(new Set(["A", "gone"]), nodes);
        expect([...kept]).toEqual(["A"]);
    });
});

describe("historyCommandOf", () => {
    const press = (key: string, extra: Partial<Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey">> = {}) =>
        ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra });

    it("maps Ctrl+Z to undo and Ctrl+Y to redo", () => {
        expect(historyCommandOf(press("z", { ctrlKey: true }))).toBe("undo");
        expect(historyCommandOf(press("y", { ctrlKey: true }))).toBe("redo");
    });

    it("maps Ctrl+Shift+Z to redo, and Cmd+Z to undo", () => {
        expect(historyCommandOf(press("Z", { ctrlKey: true, shiftKey: true }))).toBe("redo");
        expect(historyCommandOf(press("z", { metaKey: true }))).toBe("undo");
    });

    it("ignores plain keys and other shortcuts", () => {
        expect(historyCommandOf(press("z"))).toBeNull();
        expect(historyCommandOf(press("c", { ctrlKey: true }))).toBeNull();
        expect(historyCommandOf(press("z", { ctrlKey: true, altKey: true }))).toBeNull();
    });
});
