import { atom } from "jotai";
import { type KeyboardEvent } from "react";
import { navigateTreeKeyAtom, requestDeleteSelectedAtom, startEditSelectedAtom } from "@/store/store/a-bookmarks-actions";

/**
 * Keyboard handling for the bookmarks area (attached to the element that wraps the panels).
 * F2 edits the selection, Delete/Backspace asks to delete it, and the arrows navigate the tree.
 */
export const bookmarksKeyDownAtom = atom(
    null,
    (get, set, event: KeyboardEvent<HTMLDivElement>) => {
        // Ignore keys typed into fields, and keys from portaled menus/dialogs that are not inside this area.
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
            return;
        }
        if (!event.currentTarget.contains(event.target as Node)) {
            return;
        }

        switch (event.key) {
            case "F2":
                event.preventDefault();
                set(startEditSelectedAtom);
                break;
            case "Delete":
            case "Backspace":
                event.preventDefault();
                set(requestDeleteSelectedAtom);
                break;
            case "ArrowUp":
            case "ArrowDown":
            case "ArrowLeft":
            case "ArrowRight":
                event.preventDefault();
                set(navigateTreeKeyAtom, event.key);
                break;
        }
    }
);
