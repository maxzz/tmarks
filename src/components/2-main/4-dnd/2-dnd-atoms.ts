import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import { type BookmarkId } from "@/store/store/9-bookmark-types";
import { type DragSession, type DropTarget } from "./0-dnd-types";

// Drag state. Components read these atoms; only the drag controller (4-dnd-controller.ts) writes them.

/** The drag in progress, or `null`. */
export const dragSessionAtom = atom<DragSession | null>(null);

/** The drop under the pointer right now, or `null` when a drop would not be allowed there. */
export const dropTargetAtom = atom<DropTarget | null>(null);

/** Whether a row is being dragged. Each row subscribes to its own id, so only the dragged rows re-render. */
export const isDraggedAtom = atomFamily(
    (id: BookmarkId) => atom((get) => get(dragSessionAtom)?.ids.includes(id) ?? false)
);
