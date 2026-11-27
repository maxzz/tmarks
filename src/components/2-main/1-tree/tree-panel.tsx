import { useAtomValue, useSetAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { classNames } from "@/utils";
import { ScrollArea } from "@/ui/shadcn/scroll-area";
import { type BookmarkId } from "@/store/store/9-bookmark-types";
import { childFolderIdsAtom, isExpandedAtom, isTreeSelectedAtom, nodeAtom, rootFolderIdsAtom } from "@/store/store/a-bookmarks-atoms";
import { clickItemAtom, toggleExpandedAtom } from "@/store/store/a-bookmarks-actions";
import { BookmarkContextMenu } from "../3-context-menu/0-context-menu";
import { PanelContextMenu } from "../3-context-menu/1-panel-context-menu";
import { ItemPreview } from "../0-all-main/7-item-preview";
import { revealWhenSelected } from "../0-all-main/8-bookmark-ui-helpers";
import { isDraggedAtom, startDragAtom } from "../4-dnd";
import { isCutAtomFamily } from "../5-clipboard/1-clipboard-atoms";

/** The folder tree. Only folders appear here; links are listed in the right panel. */
export function Panel_Tree() {
    const rootIds = useAtomValue(rootFolderIdsAtom);

    return (
        // tabIndex lets a click on empty space focus the tree, so the selection keeps its focused look.
        // Dropping on the empty space below the rows adds to the top level (data-dnd-* attributes, see 4-dnd).
        // The viewport is the scroll container and the empty-space drop target. Its content stays auto-height (no fullHeight),
        // so the scrollbar's overflow check updates as rows expand or collapse.
        <PanelContextMenu scope="tree">
            <ScrollArea className="group/tree h-full select-none outline-none" fixedWidth viewportClassName="py-1" viewportProps={{ tabIndex: -1, "data-dnd-target": "panel", "data-dnd-zone": "tree", "data-dnd-scroll": "" }}>
                <div role="tree" aria-label="Bookmarks">
                    {rootIds.map(
                        (id) => (
                            <TreeRow key={id} id={id} depth={0} />
                        )
                    )}
                </div>
            </ScrollArea>
        </PanelContextMenu>
    );
}

function TreeRow({ id, depth }: { id: BookmarkId; depth: number; }) {
    const node = useAtomValue(nodeAtom(id));
    const childFolderIds = useAtomValue(childFolderIdsAtom(id));
    const isExpanded = useAtomValue(isExpandedAtom(id));
    const isSelected = useAtomValue(isTreeSelectedAtom(id));
    const clickItem = useSetAtom(clickItemAtom);
    const toggleExpanded = useSetAtom(toggleExpandedAtom);
    const isDragged = useAtomValue(isDraggedAtom(id));
    const isCut = useAtomValue(isCutAtomFamily(id));
    const startDrag = useSetAtom(startDragAtom);

    if (node?.kind !== "folder") {
        return null;
    }

    const hasChildren = childFolderIds.length > 0;

    return (
        <div role="none">
            <BookmarkContextMenu id={id} scope="tree">
                <div
                    className={classNames(
                        "pr-2 py-1 hover:bg-muted flex items-center gap-1.5 cursor-default",
                        isSelected
                            ? "outline outline-border text-foreground bg-muted group-focus-within/tree:bg-primary/15 group-focus-within/tree:outline-primary/40 group-focus-within/tree:hover:bg-primary/15"
                            : "outline-none",
                        (isDragged || isCut) && "opacity-50",
                    )}
                    style={{ paddingLeft: `${depth * 0.75 + 0.375}rem` }}
                    tabIndex={-1}
                    ref={revealWhenSelected(isSelected)}
                    data-dnd-target="row"
                    data-dnd-zone="tree"
                    data-dnd-id={id}
                    onPointerDown={(e) => startDrag({ event: e, id, zone: "tree" })}
                    onClick={(e) => clickItem({ id, scope: "tree", ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })}
                    title={node.title}
                    aria-selected={isSelected}
                    aria-expanded={hasChildren ? isExpanded : undefined}
                    role="treeitem"
                >
                    {hasChildren
                        ? (
                            // Hit area spans the full row height and extends to the right edge (negative margins cancel the row padding).
                            // Right padding keeps the icon's x-position unchanged; the row height is unaffected.
                            <span
                                className="self-stretch shrink-0 -my-1 -mr-2 pr-2 flex items-center"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpanded(id);
                                }}
                            >
                                <span className="size-4 hover:bg-foreground/10 rounded-sm grid place-items-center">
                                    <ChevronRight className={classNames("size-3 transition-transform duration-150", isExpanded && "rotate-90")} />
                                </span>
                            </span>
                        )
                        : <span className="shrink-0 size-4" />
                    }

                    <ItemPreview node={node} className="size-4" glyphClassName="size-[90%]" open={isExpanded} />

                    <span className="min-w-0 truncate">{node.title || "(untitled)"}</span>
                </div>
            </BookmarkContextMenu>

            {hasChildren && (
                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.div
                            key="children"
                            role="group"
                            className="overflow-hidden"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                        >
                            {childFolderIds.map((childId) => (
                                <TreeRow key={childId} id={childId} depth={depth + 1} />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
}
