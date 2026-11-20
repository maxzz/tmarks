import { useAtomValue, useSetAtom } from "jotai";
import { useSnapshot } from "valtio";
import { classNames } from "@/utils";
import { appSettings } from "@/store/1-ui-settings";
import { type BookmarkId, type BookmarkNode } from "@/store/store/9-bookmark-types";
import { currentFolderNodeAtom, currentItemIdsAtom, isSelectedAtom, nodeAtom, viewModeAtom } from "@/store/store/a-bookmarks-atoms";
import { clickItemAtom, openFolderAtom } from "@/store/store/a-bookmarks-actions";
import { BookmarkContextMenu } from "../3-context-menu/0-context-menu";
import { ItemPreview } from "../0-all-main/7-item-preview";
import { openBookmarkLink, revealWhenSelected } from "../0-all-main/8-bookmark-ui-helpers";

export function Panel_Items() {
    const viewMode = useAtomValue(viewModeAtom);
    const itemIds = useAtomValue(currentItemIdsAtom);
    const { showItemUrls } = useSnapshot(appSettings);

    return (
        // tabIndex lets a click on empty space focus the panel, so the selection keeps its focused look.
        <div tabIndex={-1} className="group/items h-full min-h-0 flex flex-col outline-none">
            <ItemsPanelHeader count={itemIds.length} />

            <div className="flex-1 p-2 min-h-0 overflow-auto">
                {itemIds.length === 0
                    ? <EmptyFolder />
                    : viewMode === "grid"
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
            </div>
        </div>
    );
}

function ItemsPanelHeader({ count }: { count: number; }) {
    const folder = useAtomValue(currentFolderNodeAtom);

    return (
        <div className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between gap-2">
            <span className="min-w-0 text-sm font-semibold truncate">{folder ? folder.title || "(untitled)" : "All bookmarks"}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{count} {count === 1 ? "item" : "items"}</span>
        </div>
    );
}

function EmptyFolder() {
    return <div className="h-full text-muted-foreground grid place-items-center">This folder is empty.</div>;
}

//---------------------------------------------------------------------------

/**
 * One row of the list. With `showUrl` the URL sits under the name. Otherwise the row shows only the name,
 * and the URL appears to the right of the name while the row is selected.
 */
function Item_InList({ id, showUrl }: { id: BookmarkId; showUrl: boolean; }) {
    const node = useAtomValue(nodeAtom(id));
    const isSelected = useAtomValue(isSelectedAtom(id));
    const clickItem = useSetAtom(clickItemAtom);
    const openFolder = useSetAtom(openFolderAtom);

    if (!node) {
        return null;
    }

    const title = node.title || "(untitled)";
    const url = node.kind === "link" ? node.url : null;

    return (
        <BookmarkContextMenu id={id} scope="items">
            <div
                className={classNames("px-2 py-1.5 hover:bg-muted rounded-sm flex items-center gap-3 cursor-default", isSelected ? selectedItemClass : "outline-none")}
                tabIndex={-1}
                ref={revealWhenSelected(isSelected)}
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
    const clickItem = useSetAtom(clickItemAtom);
    const openFolder = useSetAtom(openFolderAtom);

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
                )}
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
