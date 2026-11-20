import { atom, getDefaultStore, type Getter } from "jotai";
import { type PointerEvent as ReactPointerEvent } from "react";
import { cancelFrame, frame } from "motion/react";
import { type BookmarkId } from "@/store/store/9-bookmark-types";
import {
    bookmarkNodesAtom,
    childFolderIdsAtom,
    currentFolderIdAtom,
    currentItemIdsAtom,
    expandedIdsAtom,
    itemSelectedIdsAtom,
    treeSelectedIdsAtom,
    visibleTreeIdsAtom,
} from "@/store/store/a-bookmarks-atoms";
import { type DndZone, type DropPlacement, type DropRect, type DropTarget } from "./0-dnd-types";
import { placementAt, planMove } from "./1-dnd-logic";
import { previewX, previewY } from "./2-dnd-motion-values";
import { dragSessionAtom, dropTargetAtom } from "./2-dnd-atoms";
import { moveBookmarksAtom } from "./3-dnd-move-atoms";

// The drag controller. It runs on window pointer events, not on native HTML5 drag-and-drop, so it works between the
// two panels and does not trigger the app's file-drop handler. Components only call `startDragAtom` on pointer down.

/** Pointer movement, in pixels, before a press becomes a drag. Smaller moves are still clicks. */
const START_DISTANCE_PX = 4;
/** How long the pointer must rest on a collapsed tree folder before it expands. */
const EXPAND_DELAY_MS = 500;
/** Within this many pixels of the top or bottom of a scrollable panel, the panel scrolls. */
const SCROLL_EDGE_PX = 48;
const SCROLL_MAX_PX_PER_FRAME = 16;
/** Offset of the preview from the pointer, so the drop target under the pointer stays visible. */
const PREVIEW_OFFSET_PX = 12;

/** Press on a row, passed from the row's `onPointerDown`. */
export interface DragPress {
    event: ReactPointerEvent<HTMLElement>;
    id: BookmarkId;
    zone: DndZone;
}

/** Starts tracking a press. A drag begins only once the pointer moves `START_DISTANCE_PX`. */
export const startDragAtom = atom(
    null,
    (get, _set, press: DragPress) => {
        const { event, id, zone } = press;
        if (event.button !== 0 || !event.isPrimary) {
            return;
        }

        resetPointerTracking();
        pending = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            ids: draggedIdsFor(get, id, zone),
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onCancel);
        window.addEventListener("blur", onCancel);
        window.addEventListener("keydown", onKeyDown);
    }
);

//---------------------------------------------------------------------------
// Controller state. Plain variables, since they are only used by the window listeners above.

const store = getDefaultStore();

interface PendingDrag {
    pointerId: number;
    startX: number;
    startY: number;
    ids: BookmarkId[];
}

let pending: PendingDrag | null = null;
let pointerX = 0;
let pointerY = 0;
let expandTimer: ReturnType<typeof setTimeout> | null = null;
let expandTimerFolderId: BookmarkId | null = null;
let scrollElement: HTMLElement | null = null;
let scrollSpeed = 0;

/** Folder expansion for a folder that is under the pointer. Written by the timer that waits before expanding. */
const expandFolderAtom = atom(
    null,
    (get, set, folderId: BookmarkId) => {
        if (!get(expandedIdsAtom).has(folderId)) {
            set(expandedIdsAtom, new Set([...get(expandedIdsAtom), folderId]));
        }
    }
);

//---------------------------------------------------------------------------
// Pointer events

function onPointerMove(event: PointerEvent) {
    if (!pending || event.pointerId !== pending.pointerId) {
        return;
    }

    pointerX = event.clientX;
    pointerY = event.clientY;
    previewX.set(pointerX + PREVIEW_OFFSET_PX);
    previewY.set(pointerY + PREVIEW_OFFSET_PX);

    if (store.get(dragSessionAtom) === null) {
        if (Math.hypot(pointerX - pending.startX, pointerY - pending.startY) < START_DISTANCE_PX) {
            return;
        }
        store.set(dragSessionAtom, { ids: pending.ids });
    }

    refreshDrop();
    updateAutoScroll();
}

function onPointerUp(event: PointerEvent) {
    if (!pending || event.pointerId !== pending.pointerId) {
        return;
    }

    const session = store.get(dragSessionAtom);
    if (session) {
        suppressNextClick();
        // Look the target up again, so the drop uses the pointer position at release.
        const target = findDropTarget(pointerX, pointerY, session.ids);
        if (target) {
            store.set(moveBookmarksAtom, { ids: session.ids, placement: target.placement });
        }
    }
    endDrag();
}

function onCancel() {
    if (!pending) {
        return;
    }
    if (store.get(dragSessionAtom) !== null) {
        suppressNextClick();
    }
    endDrag();
}

function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
        onCancel();
    }
}

//---------------------------------------------------------------------------
// Drop target

/** Finds the drop under the pointer and stores it, then starts or stops the delayed expand of a tree folder. */
function refreshDrop() {
    const session = store.get(dragSessionAtom);
    if (!session) {
        return;
    }

    const target = findDropTarget(pointerX, pointerY, session.ids);
    setDropTarget(target);
    updateAutoExpand(target);
}

/** Looks at the element under the pointer. Rows give a before/after/into drop, panel backgrounds give an append. */
function findDropTarget(x: number, y: number, ids: BookmarkId[]): DropTarget | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-dnd-target]");
    if (!el) {
        return null;
    }

    const zone: DndZone = el.dataset.dndZone === "tree" ? "tree" : "items";
    const axis = el.dataset.dndAxis === "x" ? "x" : "y";
    const box = el.getBoundingClientRect();
    const rect: DropRect = { left: box.left, top: box.top, width: box.width, height: box.height };
    const nodes = store.get(bookmarkNodesAtom);

    let placement: DropPlacement;
    if (el.dataset.dndTarget === "panel") {
        // The tree's background is the top level. The items panel's background is the folder it shows.
        placement = { kind: "end", parentId: zone === "tree" ? null : store.get(currentFolderIdAtom) };
    } else {
        const node = el.dataset.dndId ? nodes[el.dataset.dndId] : undefined;
        if (!node) {
            return null;
        }
        const pos = axis === "x"
            ? (x - rect.left) / (rect.width || 1)
            : (y - rect.top) / (rect.height || 1);
        const where = placementAt(node.kind, pos);
        placement = where === "into" ? { kind: "into", folderId: node.id } : { kind: where, anchorId: node.id };
    }

    if (!planMove(nodes, ids, placement)) {
        return null;
    }
    return { placement, rect, axis, zone };
}

/** Stores the target only when it changed, so the indicator is not redrawn on every pointer move. */
function setDropTarget(target: DropTarget | null) {
    if (JSON.stringify(store.get(dropTargetAtom)) !== JSON.stringify(target)) {
        store.set(dropTargetAtom, target);
    }
}

//---------------------------------------------------------------------------
// Delayed expand of a collapsed tree folder

/** A collapsed tree folder with sub-folders expands after a short rest of the pointer over it. */
function updateAutoExpand(target: DropTarget | null) {
    const folderId = target?.zone === "tree" && target.placement.kind === "into" ? target.placement.folderId : null;
    const wanted = folderId !== null && canExpand(folderId) ? folderId : null;
    if (wanted === expandTimerFolderId) {
        return;
    }

    clearExpandTimer();
    if (wanted !== null) {
        expandTimerFolderId = wanted;
        expandTimer = setTimeout(() => {
            expandTimer = null;
            expandTimerFolderId = null;
            store.set(expandFolderAtom, wanted);
        }, EXPAND_DELAY_MS);
    }
}

function canExpand(folderId: BookmarkId): boolean {
    return !store.get(expandedIdsAtom).has(folderId) && store.get(childFolderIdsAtom(folderId)).length > 0;
}

function clearExpandTimer() {
    if (expandTimer !== null) {
        clearTimeout(expandTimer);
    }
    expandTimer = null;
    expandTimerFolderId = null;
}

//---------------------------------------------------------------------------
// Edge auto-scroll, one Motion frame at a time

/** Starts or stops scrolling the panel under the pointer, when the pointer is near its top or bottom edge. */
function updateAutoScroll() {
    const el = document.elementFromPoint(pointerX, pointerY)?.closest<HTMLElement>("[data-dnd-scroll]") ?? null;
    scrollElement = el;
    scrollSpeed = el ? edgeScrollSpeed(el.getBoundingClientRect()) : 0;

    if (scrollSpeed !== 0) {
        frame.update(autoScrollStep, true);
    } else {
        cancelFrame(autoScrollStep);
    }
}

function edgeScrollSpeed(box: DOMRect): number {
    const fromTop = pointerY - box.top;
    const fromBottom = box.bottom - pointerY;
    if (fromTop < SCROLL_EDGE_PX) {
        return -SCROLL_MAX_PX_PER_FRAME * (1 - Math.max(0, fromTop) / SCROLL_EDGE_PX);
    }
    if (fromBottom < SCROLL_EDGE_PX) {
        return SCROLL_MAX_PX_PER_FRAME * (1 - Math.max(0, fromBottom) / SCROLL_EDGE_PX);
    }
    return 0;
}

function autoScrollStep() {
    if (!scrollElement || scrollSpeed === 0) {
        cancelFrame(autoScrollStep);
        return;
    }
    scrollElement.scrollTop += scrollSpeed;
    refreshDrop();
}

//---------------------------------------------------------------------------
// Helpers

/** The items a press drags. A row that is part of the panel's selection drags the whole selection, else only itself. */
function draggedIdsFor(get: Getter, id: BookmarkId, zone: DndZone): BookmarkId[] {
    const selected = zone === "tree" ? get(treeSelectedIdsAtom) : get(itemSelectedIdsAtom);
    if (!selected.has(id)) {
        return [id];
    }

    // Keep the on-screen order, and only the items the panel shows now.
    const order = zone === "tree" ? get(visibleTreeIdsAtom) : get(currentItemIdsAtom);
    const ids = order.filter((candidate) => selected.has(candidate));
    return ids.includes(id) ? ids : [id];
}

/** Ends the drag, or the press if the pointer never moved far enough to start one. */
function endDrag() {
    resetPointerTracking();
    store.set(dropTargetAtom, null);
    store.set(dragSessionAtom, null);
}

/** Removes the window listeners and stops the timers and the auto-scroll. */
function resetPointerTracking() {
    pending = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("blur", onCancel);
    window.removeEventListener("keydown", onKeyDown);
    clearExpandTimer();
    cancelFrame(autoScrollStep);
    scrollElement = null;
    scrollSpeed = 0;
}

/** After a drag, the click that the browser sends on release must not select the row or open the item. */
function suppressNextClick() {
    const stop = (event: MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();
    };
    window.addEventListener("click", stop, { capture: true, once: true });
    // A click is sent right after the pointer is released. If none comes, remove the listener so it cannot catch a later click.
    setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
}
