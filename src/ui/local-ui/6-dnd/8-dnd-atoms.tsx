import { atom } from "jotai";
import { importBookmarkFilesAtom } from "@/components/2-main/bookmarks/store/a-bookmarks-actions";

export type DoSetFilesFrom_Dnd_Atom = typeof doSetFilesFrom_Dnd_Atom;

/**
 * Drop target used by DropItDoc: receives the DataTransfer of a drop and imports the dropped files.
 * The File objects are read synchronously, because a DataTransfer is only valid during the drop event.
 */
export const doSetFilesFrom_Dnd_Atom = atom(
    null,
    (_get, set, dataTransfer: DataTransfer) => {
        const files = Array.from(dataTransfer.files);
        set(importBookmarkFilesAtom, files);
    }
);
