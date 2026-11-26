import { describe, it, expect } from "vitest";
import { type BookmarkNodes } from "@/store/store/9-bookmark-types";
import { addNewItem, normalizeUrl } from "./0-new-item-logic";

function makeDoc(): { nodes: BookmarkNodes; rootIds: string[]; } {
    return {
        nodes: {
            A: { kind: "folder", id: "A", parentId: null, title: "A", addDate: 1, lastModified: 1, childIds: ["L"], isToolbar: false },
            L: { kind: "link", id: "L", parentId: "A", title: "L", addDate: 1, lastModified: 1, url: "https://l.example", iconId: null },
        },
        rootIds: ["A"],
    };
}

describe("normalizeUrl", () => {
    it("adds https:// to an address without a scheme", () => {
        expect(normalizeUrl(" example.com/path ")).toBe("https://example.com/path");
    });

    it("keeps an address that has a scheme", () => {
        expect(normalizeUrl("http://example.com")).toBe("http://example.com");
        expect(normalizeUrl("mailto:me@example.com")).toBe("mailto:me@example.com");
    });

    it("returns an empty string for empty input", () => {
        expect(normalizeUrl("   ")).toBe("");
    });
});

describe("addNewItem", () => {
    it("adds a folder at the end of the top level", () => {
        const result = addNewItem(makeDoc(), null, { kind: "folder", title: " Work ", url: "" }, "N", 9);
        expect(result!.rootIds).toEqual(["A", "N"]);
        expect(result!.nodes.N).toMatchObject({ kind: "folder", parentId: null, title: "Work", childIds: [], addDate: 9 });
    });

    it("adds a bookmark at the end of a folder", () => {
        const result = addNewItem(makeDoc(), "A", { kind: "link", title: "Ex", url: "example.com" }, "N", 9);
        const A = result!.nodes.A;
        expect(A.kind === "folder" && A.childIds).toEqual(["L", "N"]);
        expect(result!.nodes.N).toMatchObject({ kind: "link", parentId: "A", title: "Ex", url: "https://example.com", iconId: null });
    });

    it("names a bookmark without a name after its URL", () => {
        const result = addNewItem(makeDoc(), "A", { kind: "link", title: "  ", url: "example.com" }, "N", 9);
        expect(result!.nodes.N.title).toBe("https://example.com");
    });

    it("refuses an empty folder name, a bookmark without URL, and a parent that is not a folder", () => {
        expect(addNewItem(makeDoc(), null, { kind: "folder", title: " ", url: "" }, "N", 9)).toBeNull();
        expect(addNewItem(makeDoc(), "A", { kind: "link", title: "Ex", url: "" }, "N", 9)).toBeNull();
        expect(addNewItem(makeDoc(), "L", { kind: "folder", title: "F", url: "" }, "N", 9)).toBeNull();
        expect(addNewItem(makeDoc(), "missing", { kind: "folder", title: "F", url: "" }, "N", 9)).toBeNull();
    });
});
