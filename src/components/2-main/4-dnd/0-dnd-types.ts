import { type BookmarkId } from "@/store/store/9-bookmark-types";
import { type TabId } from "@/store/tabs/0-tabs-types";

/** The panel a drag starts in, or a drop target belongs to. `tab` is a tab's header in the tab strip. */
export type DndZone = "tree" | "items" | "tab";

/**
 * Where dropped items go. `before` and `after` put them next to a row, in that row's folder. `into` puts them
 * inside a folder. `end` appends them to a container (`parentId` `null` is the top level).
 */
export type DropPlacement =
    | { kind: "before" | "after"; anchorId: BookmarkId; }
    | { kind: "into"; folderId: BookmarkId; }
    | { kind: "end"; parentId: BookmarkId | null; };

/** A rectangle in viewport pixels, as from `getBoundingClientRect`. */
export interface DropRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** The drop under the pointer. `rect` and `axis` only decide where the indicator is drawn. */
export interface DropTarget {
    placement: DropPlacement;
    rect: DropRect;
    /** `y` for rows in a column, `x` for grid cards. Decides whether `before`/`after` is a line above/below or left/right. */
    axis: "x" | "y";
    /** The panel the target is in. A collapsed tree folder under the pointer expands after a short delay. */
    zone: DndZone;
    /** The tab whose document `placement` refers to. When it is not the drag's source tab, the drop is a transfer. */
    tabId: TabId;
}

/** A drag in progress, started once the pointer has moved a few pixels. */
export interface DragSession {
    /** The items being dragged, in display order. */
    ids: BookmarkId[];
    /** The tab the items are in. Hovering another tab's header shows that tab, so the drag can end there. */
    sourceTabId: TabId;
    /** Title of the first item, for the preview. Kept here because the item is not shown once another tab is. */
    label: string;
}
