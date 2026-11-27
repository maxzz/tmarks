import { useAtomValue, useSetAtom } from "jotai";
import { useSnapshot } from "valtio";
import { classNames } from "@/utils";
import { ScrollArea } from "@/ui/shadcn/scroll-area";
import { appSettings } from "@/store/1-ui-settings";
import { type BookmarkId, type BookmarkNode } from "@/store/store/9-bookmark-types";
import { currentFolderIdAtom, currentFolderNodeAtom, currentItemIdsAtom, isSelectedAtom, nodeAtom, viewModeAtom } from "@/store/store/a-bookmarks-atoms";
import { clickItemAtom, openFolderAtom } from "@/store/store/a-bookmarks-actions";
import { BookmarkContextMenu } from "../3-context-menu/0-context-menu";
import { PanelContextMenu } from "../3-context-menu/1-panel-context-menu";
import { ItemPreview } from "../0-all-main/7-item-preview";
import { openBookmarkLink, revealWhenSelected } from "../0-all-main/8-bookmark-ui-helpers";
import { isDraggedAtom, startDragAtom } from "../4-dnd";
import { isCutAtomFamily } from "../5-clipboard/1-clipboard-atoms";

export function Panel_Items() {
    const viewMode = useAtomValue(viewModeAtom);
    const itemIds = useAtomValue(currentItemIdsAtom);
    const folderId = useAtomValue(currentFolderIdAtom);
    const { showItemUrls } = useSnapshot(appSettings);

    // Nothing is selected in the tree, so no folder is shown. The panel stays empty, with no header or message.
    if (folderId === null) {
        return (
            <PanelContextMenu scope="items">
                <div tabIndex={-1} className="group/items h-full min-h-0 outline-none" />
            </PanelContextMenu>
        );
    }

    return (
        // tabIndex lets a click on empty space focus the panel, so the selection keeps its focused look.
        <PanelContextMenu scope="items">
            <div tabIndex={-1} className="group/items h-full min-h-0 flex flex-col outline-none">
                <ItemsPanelHeader count={itemIds.length} />
    
                {/* data-dnd-*: dropping on the empty space adds to the shown folder (see 4-dnd). */}
                {itemIds.length === 0
                    ? (
                        <div className="flex-1 min-h-0 p-2 flex flex-col" data-dnd-target="panel" data-dnd-zone="items">
                            <EmptyFolder />
                        </div>
                    )
                    : (
                        // The viewport is the scroll container and the empty-space drop target. The content stays auto-height
                        // (no fullHeight), so the scrollbar's overflow check updates as rows are added or removed.
                        <ScrollArea className="flex-1 min-h-0" fixedWidth viewportClassName="p-2" viewportProps={{ "data-dnd-target": "panel", "data-dnd-zone": "items", "data-dnd-scroll": "" }}>
                            {viewMode === "grid"
                                ? (
                                    <div className="select-none grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2" role="listbox" aria-label="Items" aria-multiselectable="true">
                                        {itemIds.map(
                                            (id) => <Item_InGrid key={id} id={id} showUrl={showItemUrls} />
                                        )}
                                    </div>
                                )
                                : (
                                    <div className="select-none flex flex-col gap-px" role="listbox" aria-label="Items" aria-multiselectable="true">
                                        {itemIds.map(
                                            (id) => <Item_InList key={id} id={id} showUrl={showItemUrls} />
                                        )}
                                    </div>
                                )
                            }
                        </ScrollArea>
                    )
                }
            </div>
        </PanelContextMenu>
    );
}

function ItemsPanelHeader({ count }: { count: number; }) {
    const folder = useAtomValue(currentFolderNodeAtom);

    return (
        <div className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between gap-2">
            <span className="min-w-0 text-sm font-semibold truncate">{folder?.title || "(untitled)"}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{count} {count === 1 ? "item" : "items"}</span>
        </div>
    );
}

function EmptyFolder() {
    return <div className="flex-1 text-muted-foreground grid place-items-center">This folder is empty.</div>;
}

//---------------------------------------------------------------------------

/**
 * One row of the list. With `showUrl` the URL sits under the name. Otherwise the row shows only the name,
 * and the URL appears to the right of the name while the row is selected.
 */
function Item_InList({ id, showUrl }: { id: BookmarkId; showUrl: boolean; }) {
    const node = useAtomValue(nodeAtom(id));
    const isSelected = useAtomValue(isSelectedAtom(id));
    const isDragged = useAtomValue(isDraggedAtom(id));
    const isCut = useAtomValue(isCutAtomFamily(id));
    const clickItem = useSetAtom(clickItemAtom);
    const openFolder = useSetAtom(openFolderAtom);
    const startDrag = useSetAtom(startDragAtom);

    if (!node) {
        return null;
    }

    const title = node.title || "(untitled)";
    const url = node.kind === "link" ? node.url : null;

    return (
        <BookmarkContextMenu id={id} scope="items">
            <div
                className={classNames("px-2 py-1.5 hover:bg-muted rounded-sm flex items-center gap-3 cursor-default", isSelected ? selectedItemClass : "outline-none", (isDragged || isCut) && "opacity-50")}
                tabIndex={-1}
                ref={revealWhenSelected(isSelected)}
                data-dnd-target="row"
                data-dnd-zone="items"
                data-dnd-id={id}
                data-dnd-axis="y"
                onPointerDown={(e) => startDrag({ event: e, id, zone: "items" })}
                onClick={(e) => clickItem({ id, scope: "items", ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })}
                onDoubleClick={() => openItem(node, openFolder)}
                aria-selected={isSelected}
                role="option"
            >
                <ItemPreview node={node} className="size-4 rounded-sm" />

                {showUrl
                    ? (
                        <div className="flex-1 min-w-0 flex flex-col">
                            <span className="text-sm truncate">{title}</span>
                            {url !== null && (
                                <span className="text-[0.7rem] text-muted-foreground truncate">
                                    {url}
                                </span>
                            )}
                        </div>
                    )
                    : (
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className={classNames("min-w-0 text-xs truncate", isSelected && url && "max-w-[60%]")}>
                                {title}
                            </span>
                            {isSelected && url && (
                                <span className="flex-1 min-w-0 text-[0.7rem] text-muted-foreground truncate">
                                    {url}
                                </span>
                            )}
                        </div>
                    )
                }
            </div>
        </BookmarkContextMenu>
    );
}

//---------------------------------------------------------------------------

/** A grid card. Without `showUrl` the URL is shown below the name only while the card is selected. */
function Item_InGrid({ id, showUrl }: { id: BookmarkId; showUrl: boolean; }) {
    const node = useAtomValue(nodeAtom(id));
    const isSelected = useAtomValue(isSelectedAtom(id));
    const isDragged = useAtomValue(isDraggedAtom(id));
    const isCut = useAtomValue(isCutAtomFamily(id));
    const clickItem = useSetAtom(clickItemAtom);
    const openFolder = useSetAtom(openFolderAtom);
    const startDrag = useSetAtom(startDragAtom);

    if (!node) {
        return null;
    }

    return (
        <BookmarkContextMenu id={id} scope="items">
            <div
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                ref={revealWhenSelected(isSelected)}
                className={classNames(
                    "p-2 text-center hover:bg-muted border border-transparent rounded-md flex flex-col items-center gap-2 cursor-default",
                    isSelected ? selectedItemClass : "outline-none",
                    (isDragged || isCut) && "opacity-50",
                )}
                data-dnd-target="row"
                data-dnd-zone="items"
                data-dnd-id={id}
                data-dnd-axis="x"
                onPointerDown={(e) => startDrag({ event: e, id, zone: "items" })}
                onClick={(e) => clickItem({ id, scope: "items", ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })}
                onDoubleClick={() => openItem(node, openFolder)}
            >
                <ItemPreview node={node} className="size-4 rounded-sm" />

                <span className="w-full text-xs line-clamp-2 wrap-break-word">
                    {node.title || "(untitled)"}
                </span>
                
                {node.kind === "link" && (showUrl || isSelected) && (
                    <span className="w-full text-[0.65rem] text-muted-foreground truncate">{node.url}</span>
                )}
            </div>
        </BookmarkContextMenu>
    );
}

/**
 * Selected row or card. Light gray with a darker outline while the items panel does not have focus; blue with a
 * blue outline while it does. Both panels use the same look (see `group/tree` in the tree panel).
 */
const selectedItemClass = "outline outline-border bg-muted group-focus-within/items:bg-primary/15 group-focus-within/items:outline-primary/40 group-focus-within/items:hover:bg-primary/15";

/** Double-click opens a link in a new tab, or opens a folder to show its contents. Single click only selects. */
function openItem(node: BookmarkNode, openFolder: (id: BookmarkId) => void) {
    if (node.kind === "link") {
        openBookmarkLink(node.url);
    } else {
        openFolder(node.id);
    }
}
