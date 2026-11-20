import { atom, getDefaultStore, type Getter, type Setter } from "jotai";
import {
    bookmarkIconsAtom,
    bookmarkNodesAtom,
    bookmarkRootIdsAtom,
    itemSelectedIdAtom,
    itemSelectedIdsAtom,
    treeSelectedIdAtom,
    treeSelectedIdsAtom,
} from "@/store/store/a-bookmarks-atoms";
import {
    type HistoryCommand,
    type HistorySnapshot,
    isSameTree,
    keepExistingId,
    keepExistingIds,
    pickReferencedIcons,
    pushStep,
} from "./0-history-logic";

// Undo and redo for the bookmarks document. Every change to the document is recorded by itself: the document atoms are
// watched, and the changes made by one action become one step. Nothing else has to call into this file.
// Only the document is tracked (items, folders, icons). Selection and expansion are not, so undo does not move them.

const undoStackAtom = atom<HistorySnapshot[]>([]);
const redoStackAtom = atom<HistorySnapshot[]>([]);

export const canUndoAtom = atom((get) => get(undoStackAtom).length > 0);
export const canRedoAtom = atom((get) => get(redoStackAtom).length > 0);

//---------------------------------------------------------------------------
// Recording. A store subscription says that a document atom changed. The check runs in a microtask, after the
// synchronous action that made the change has finished, so one action gives one step.

const store = getDefaultStore();

/** The document as of the last check. A change is recorded when the document differs from it. */
let committed = readDocument(store.get);
let checkScheduled = false;

store.sub(bookmarkNodesAtom, scheduleCheck);
store.sub(bookmarkRootIdsAtom, scheduleCheck);
store.sub(bookmarkIconsAtom, scheduleCheck);

function scheduleCheck() {
    if (!checkScheduled) {
        checkScheduled = true;
        queueMicrotask(() => recordPendingChange(store.get, store.set));
    }
}

/**
 * Pushes the document as it was before the change onto the undo stack, and clears the redo stack. A change that only
 * fills the icon cache (icons loaded from IndexedDB at startup) is not an edit, so it is absorbed without a step.
 */
function recordPendingChange(get: Getter, set: Setter) {
    checkScheduled = false;
    const current = readDocument(get);
    if (!isSameTree(committed, current)) {
        set(undoStackAtom, pushStep(get(undoStackAtom), committed));
        set(redoStackAtom, []);
    }
    committed = current;
}

function readDocument(get: Getter): HistorySnapshot {
    return {
        nodes: get(bookmarkNodesAtom),
        rootIds: get(bookmarkRootIdsAtom),
        icons: get(bookmarkIconsAtom),
    };
}

//---------------------------------------------------------------------------
// Undo and redo

/** Steps back to the state before the last change. Any change not yet recorded is recorded first. */
export const undoAtom = atom(
    null,
    (get, set) => {
        recordPendingChange(get, set);
        const undoStack = get(undoStackAtom);
        const target = undoStack[undoStack.length - 1];
        if (!target) {
            return;
        }

        set(undoStackAtom, undoStack.slice(0, -1));
        set(redoStackAtom, pushStep(get(redoStackAtom), readDocument(get)));
        applySnapshot(get, set, target);
    }
);

/** Steps forward again after an undo. Any new change clears the redo stack. */
export const redoAtom = atom(
    null,
    (get, set) => {
        recordPendingChange(get, set);
        const redoStack = get(redoStackAtom);
        const target = redoStack[redoStack.length - 1];
        if (!target) {
            return;
        }

        set(redoStackAtom, redoStack.slice(0, -1));
        set(undoStackAtom, pushStep(get(undoStackAtom), readDocument(get)));
        applySnapshot(get, set, target);
    }
);

/** Runs undo or redo, for the keyboard shortcuts. */
export const runHistoryCommandAtom = atom(
    null,
    (_get, set, command: HistoryCommand) => {
        set(command === "undo" ? undoAtom : redoAtom);
    }
);

/** Puts a snapshot back into the document. Icons come from the snapshot and from the cache now, and only the ones still used are kept. */
function applySnapshot(get: Getter, set: Setter, snapshot: HistorySnapshot) {
    const icons = pickReferencedIcons(snapshot.nodes, { ...get(bookmarkIconsAtom), ...snapshot.icons });

    set(bookmarkNodesAtom, snapshot.nodes);
    set(bookmarkRootIdsAtom, snapshot.rootIds);
    set(bookmarkIconsAtom, icons);

    // The selection can point at items that the step removed, so the selected ids that are gone are dropped.
    set(treeSelectedIdAtom, (id) => keepExistingId(id, snapshot.nodes));
    set(treeSelectedIdsAtom, (ids) => keepExistingIds(ids, snapshot.nodes));
    set(itemSelectedIdAtom, (id) => keepExistingId(id, snapshot.nodes));
    set(itemSelectedIdsAtom, (ids) => keepExistingIds(ids, snapshot.nodes));

    committed = { nodes: snapshot.nodes, rootIds: snapshot.rootIds, icons };
}
