import { atom } from "jotai";
import { uuid } from "@/utils/uuid";
import { type BookmarkId } from "../store/9-bookmark-types";
import {
    bookmarkNodesAtom,
    bookmarkRootIdsAtom,
    currentFolderIdAtom,
    expandedIdsAtom,
    itemSelectedIdAtom,
    itemSelectedIdsAtom,
    selectionPanelAtom,
} from "../store/a-bookmarks-atoms";
import { selectItemAtom } from "../store/a-bookmarks-actions";
import { addNewItem, NEW_FOLDER_TITLE, type NewItemKind } from "./0-new-item-logic";

// "Add new folder" and "Add new bookmark". The item is created only when the dialog is saved, so Cancel leaves
// nothing behind, and the new item is one undo step.

export interface NewItemDraft {
    kind: NewItemKind;
    /** The folder the item goes into, at the end; `null` for the top level. */
    parentId: BookmarkId | null;
    /** Where the command came from. A new item is selected in that panel. */
    scope: "tree" | "items";
    title: string;
    url: string;
}

/** Whether the dialog is open. Kept apart from the draft, so the dialog does not change while it animates closed. */
export const newItemDialogOpenAtom = atom(false);
export const newItemDraftAtom = atom<NewItemDraft>({ kind: "folder", parentId: null, scope: "tree", title: "", url: "" });

/** Opens the dialog for a new item at the end of `parentId`. */
export const startNewItemAtom = atom(
    null,
    (_get, set, { kind, parentId, scope }: Pick<NewItemDraft, "kind" | "parentId" | "scope">) => {
        set(newItemDraftAtom, { kind, parentId, scope, title: kind === "folder" ? NEW_FOLDER_TITLE : "", url: "" });
        set(newItemDialogOpenAtom, true);
    }
);

/** "Add new folder" or "Add new bookmark" from a panel's menu: into the top level (tree) or the shown folder (right panel). */
export const startNewItemInPanelAtom = atom(
    null,
    (get, set, { kind, scope }: { kind: NewItemKind; scope: "tree" | "items"; }) => {
        const parentId = scope === "tree" ? null : get(currentFolderIdAtom);
        if (scope === "items" && parentId === null) {
            return;
        }
        set(startNewItemAtom, { kind, parentId, scope });
    }
);

export const cancelNewItemAtom = atom(
    null,
    (_get, set) => {
        set(newItemDialogOpenAtom, false);
    }
);

/**
 * Creates the item and selects it: a folder made from the tree is selected there, so the right panel shows it;
 * an item made in the right panel is selected in that panel. An empty name, or a bookmark without URL, is rejected.
 */
export const commitNewItemAtom = atom(
    null,
    (get, set) => {
        const draft = get(newItemDraftAtom);
        const id = uuid();
        const result = addNewItem(
            { nodes: get(bookmarkNodesAtom), rootIds: get(bookmarkRootIdsAtom) },
            draft.parentId,
            draft,
            id,
            Math.floor(Date.now() / 1000),
        );
        if (!result) {
            return;
        }

        set(newItemDialogOpenAtom, false);
        set(bookmarkNodesAtom, result.nodes);
        set(bookmarkRootIdsAtom, result.rootIds);

        if (draft.scope === "tree") {
            set(selectItemAtom, id);
            return;
        }
        if (draft.parentId !== null) {
            set(expandedIdsAtom, new Set([...get(expandedIdsAtom), draft.parentId]));
        }
        if (draft.parentId === get(currentFolderIdAtom)) {
            set(selectionPanelAtom, "items");
            set(itemSelectedIdsAtom, new Set([id]));
            set(itemSelectedIdAtom, id);
        }
    }
);
