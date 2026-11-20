import { atom, type Getter } from "jotai";
import { type BookmarkId } from "@/store/store/9-bookmark-types";
import { bookmarkNodesAtom, currentFolderIdAtom, deleteDialogOpenAtom, editingIdAtom, selectedIdsAtom } from "@/store/store/a-bookmarks-atoms";
import { requestDeleteAtom, startEditAtom } from "@/store/store/a-bookmarks-actions";
import { copyItemsAtom, cutItemsAtom, pasteIntoAtom } from "../5-clipboard/1-clipboard-atoms";
import { focusBookmarksArea } from "../0-all-main/8-bookmark-ui-helpers";

//---------------------------------------------------------------------------
// Context-menu actions. Each one is a Jotai write atom, so the menu components only call `set` and hold no state.
// The menu does not change the selection. Selecting a folder in the right panel would open it and remove the
// row that was right-clicked, so the menu acts on the clicked item (or on the whole selection, see below).

/** "Edit": opens the edit dialog for the clicked item. */
export const editContextItemAtom = atom(
    null,
    (get, set, id: BookmarkId) => {
        set(startEditAtom, id);
    }
);

/**
 * "Delete": asks for confirmation before deleting. When the clicked item is part of the selection, the whole
 * selection is deleted (so several items can go at once); otherwise only the clicked item is.
 */
export const deleteContextItemAtom = atom(
    null,
    (get, set, id: BookmarkId) => {
        const selected = get(selectedIdsAtom);
        set(requestDeleteAtom, selected.has(id) ? selected : new Set([id]));
    }
);

/**
 * The items a menu command acts on: the whole selection when the clicked item is part of it, otherwise only the
 * clicked item. Same rule as "Delete".
 */
function contextItemIds(get: Getter, id: BookmarkId): BookmarkId[] {
    const selected = get(selectedIdsAtom);
    return selected.has(id) ? [...selected] : [id];
}

/** "Cut": marks the clicked item (or the selection) to be moved by a later paste. */
export const cutContextItemAtom = atom(
    null,
    (get, set, id: BookmarkId) => {
        set(cutItemsAtom, contextItemIds(get, id));
    }
);

/** "Copy": copies the clicked item (or the selection) for a later paste. */
export const copyContextItemAtom = atom(
    null,
    (get, set, id: BookmarkId) => {
        set(copyItemsAtom, contextItemIds(get, id));
    }
);

/** "Paste": into the clicked folder. On a link, into the folder the right panel shows. */
export const pasteContextItemAtom = atom(
    null,
    (get, set, id: BookmarkId) => {
        const node = get(bookmarkNodesAtom)[id];
        set(pasteIntoAtom, node?.kind === "folder" ? node.id : get(currentFolderIdAtom));
    }
);

/**
 * Runs when a context menu closes. Radix would return focus to the element that had it before the menu opened,
 * which can pull focus away from a dialog that is opening. So focus goes to the bookmarks area only when a
 * dialog did not open and nothing else has taken focus. Otherwise the keyboard shortcuts would stop working.
 */
export const restoreFocusAfterContextMenuAtom = atom(
    null,
    (get) => {
        const dialogOpen = get(editingIdAtom) !== null || get(deleteDialogOpenAtom);
        const active = document.activeElement;
        if (!dialogOpen && (active === null || active === document.body)) {
            focusBookmarksArea();
        }
    }
);
