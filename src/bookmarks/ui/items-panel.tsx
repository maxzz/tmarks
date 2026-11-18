import { useAtomValue, useSetAtom } from "jotai";
import { classNames } from "@/utils";
import { type BookmarkId, type BookmarkNode } from "../model/bookmark-types";
import { currentFolderNodeAtom, currentItemIdsAtom, isSelectedAtom, nodeAtom, viewModeAtom } from "../store/bookmarks-atoms";
import { clickItemAtom } from "../store/bookmarks-actions";
import { ItemPreview } from "./item-preview";
import { openBookmarkLink, revealWhenSelected } from "./bookmark-ui-helpers";

export function ItemsPanel() {
    const viewMode = useAtomValue(viewModeAtom);
    const itemIds = useAtomValue(currentItemIdsAtom);

    return (
        <div className="h-full min-h-0 flex flex-col">
            <ItemsPanelHeader count={itemIds.length} />

            <div className="p-2 min-h-0 overflow-auto flex-1">
                {itemIds.length === 0
                    ? <EmptyFolder />
                    : viewMode === "grid"
                        ? (
                            <div role="listbox" aria-label="Items" aria-multiselectable="true" className="select-none grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
                                {itemIds.map((id) => <ItemCard key={id} id={id} />)}
                            </div>
                        )
                        : (
                            <div role="listbox" aria-label="Items" aria-multiselectable="true" className="select-none flex flex-col gap-px">
                                {itemIds.map((id) => <ItemRow key={id} id={id} />)}
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

function ItemRow({ id }: { id: BookmarkId; }) {
    const node = useAtomValue(nodeAtom(id));
    const isSelected = useAtomValue(isSelectedAtom(id));
    const clickItem = useSetAtom(clickItemAtom);

    if (!node) {
        return null;
    }

    return (
        <div
            role="option"
            aria-selected={isSelected}
            tabIndex={-1}
            ref={revealWhenSelected(isSelected)}
            className={classNames(
                "px-2 py-1.5 hover:bg-muted outline-none rounded-sm flex items-center gap-3 cursor-default",
                isSelected && "bg-primary/15 hover:bg-primary/15",
            )}
            onClick={(e) => clickItem({ id, scope: "items", ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })}
            onDoubleClick={() => openItem(node)}
        >
            <ItemPreview node={node} className="size-7 rounded-sm" />

            <div className="min-w-0 flex-1 flex flex-col">
                <span className="text-sm truncate">{node.title || "(untitled)"}</span>
                {node.kind === "link" && <span className="text-[0.7rem] text-muted-foreground truncate">{node.url}</span>}
            </div>
        </div>
    );
}

function ItemCard({ id }: { id: BookmarkId; }) {
    const node = useAtomValue(nodeAtom(id));
    const isSelected = useAtomValue(isSelectedAtom(id));
    const clickItem = useSetAtom(clickItemAtom);

    if (!node) {
        return null;
    }

    return (
        <div
            role="option"
            aria-selected={isSelected}
            tabIndex={-1}
            ref={revealWhenSelected(isSelected)}
            className={classNames(
                "p-2 text-center hover:bg-muted border border-transparent outline-none rounded-md flex flex-col items-center gap-2 cursor-default",
                isSelected && "bg-primary/15 hover:bg-primary/15 border-primary/40",
            )}
            onClick={(e) => clickItem({ id, scope: "items", ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })}
            onDoubleClick={() => openItem(node)}
        >
            <ItemPreview node={node} className="size-14 rounded-sm" />

            <span className="w-full text-xs line-clamp-2 break-words">{node.title || "(untitled)"}</span>
            {node.kind === "link" && <span className="w-full text-[0.65rem] text-muted-foreground truncate">{node.url}</span>}
        </div>
    );
}

/** Double-click opens a bookmark. Folders are already opened by the single click that selects them. */
function openItem(node: BookmarkNode) {
    if (node.kind === "link") {
        openBookmarkLink(node.url);
    }
}
