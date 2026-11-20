import { atom } from "jotai";
import { notice } from "@/ui/local-ui/7-toaster";
import { currentFolderIdAtom, selectedIdsAtom } from "@/store/store/a-bookmarks-atoms";
import { copyItemsAtom, cutItemsAtom, pasteIntoAtom } from "./1-clipboard-atoms";

export type ClipboardShortcut = "copy" | "cut" | "paste";

/** Ctrl+C, Ctrl+X and Ctrl+V (Cmd on macOS). Returns `null` for any other key press. */
export function clipboardShortcutOf(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): ClipboardShortcut | null {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) {
        return null;
    }
    switch (event.key.toLowerCase()) {
        case "c":
            return "copy";
        case "x":
            return "cut";
        case "v":
            return "paste";
        default:
            return null;
    }
}

/**
 * Runs a clipboard shortcut. Copy and Cut act on the active selection, as Delete does. Paste goes into the folder
 * the right panel shows.
 */
export const clipboardShortcutAtom = atom(
    null,
    (get, set, shortcut: ClipboardShortcut) => {
        if (shortcut === "paste") {
            const folderId = get(currentFolderIdAtom);
            if (folderId === null) {
                // Nothing is shown in the right panel, so there is no folder to paste into.
                notice.info("Select a folder to paste into.");
                return;
            }
            set(pasteIntoAtom, folderId);
            return;
        }

        const ids = [...get(selectedIdsAtom)];
        if (shortcut === "copy") {
            set(copyItemsAtom, ids);
        } else {
            set(cutItemsAtom, ids);
        }
    }
);
