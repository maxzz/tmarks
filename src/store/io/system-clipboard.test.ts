import { describe, it, expect } from "vitest";
import { type BookmarkDocument } from "@/store/store/9-bookmark-types";
import { clipboardHtml, clipboardText } from "./system-clipboard";

const doc: BookmarkDocument = {
    nodes: {
        F: { kind: "folder", id: "F", parentId: null, title: "Work & play", addDate: 1, lastModified: 1, childIds: ["L1"], isToolbar: false },
        L1: { kind: "link", id: "L1", parentId: "F", title: "<One>", addDate: 1, lastModified: 1, url: "https://one.example/?a=1&b=2", iconId: null },
        L2: { kind: "link", id: "L2", parentId: null, title: "", addDate: 1, lastModified: 1, url: "https://two.example", iconId: null },
    },
    rootIds: ["F", "L2"],
    icons: {},
};

describe("system clipboard formats", () => {
    it("writes a nested, escaped HTML list", () => {
        expect(clipboardHtml(doc)).toBe(
            '<ul><li>Work &amp; play<ul><li><a href="https://one.example/?a=1&amp;b=2">&lt;One&gt;</a></li></ul></li>'
            + '<li><a href="https://two.example">https://two.example</a></li></ul>'
        );
    });

    it("writes the URLs of all links, folders included, one per line", () => {
        expect(clipboardText(doc)).toBe("https://one.example/?a=1&b=2\nhttps://two.example");
    });
});
