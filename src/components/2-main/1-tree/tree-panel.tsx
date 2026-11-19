import { useAtomValue, useSetAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { classNames } from "@/utils";
import { type BookmarkId } from "@/store/store/9-bookmark-types";
import { childFolderIdsAtom, isExpandedAtom, isTreeSelectedAtom, nodeAtom, rootFolderIdsAtom } from "@/store/store/a-bookmarks-atoms";
import { clickItemAtom, toggleExpandedAtom } from "@/store/store/a-bookmarks-actions";
import { BookmarkContextMenu } from "../3-context-menu/bookmark-context-menu";
import { ItemPreview } from "../0-all-main/7-item-preview";
import { revealWhenSelected } from "../0-all-main/8-bookmark-ui-helpers";

/** The folder tree. Only folders appear here; links are listed in the right panel. */
export function Panel_Tree() {
    const rootIds = useAtomValue(rootFolderIdsAtom);

    return (
        // tabIndex lets a click on empty space focus the tree, so the selection keeps its focused look.
        <div role="tree" aria-label="Bookmarks" tabIndex={-1} className="group/tree py-1 h-full select-none overflow-auto outline-none">
            {rootIds.map(
                (id) => (
                    <TreeRow key={id} id={id} depth={0} />
                )
            )}
        </div>
    );
}

function TreeRow({ id, depth }: { id: BookmarkId; depth: number; }) {
    const node = useAtomValue(nodeAtom(id));
    const childFolderIds = useAtomValue(childFolderIdsAtom(id));
    const isExpanded = useAtomValue(isExpandedAtom(id));
    const isSelected = useAtomValue(isTreeSelectedAtom(id));
    const clickItem = useSetAtom(clickItemAtom);
    const toggleExpanded = useSetAtom(toggleExpandedAtom);

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
                    )}
                    style={{ paddingLeft: `${depth * 0.75 + 0.375}rem` }}
                    tabIndex={-1}
                    ref={revealWhenSelected(isSelected)}
                    onClick={(e) => clickItem({ id, scope: "tree", ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })}
                    title={node.title}
                    aria-selected={isSelected}
                    aria-expanded={hasChildren ? isExpanded : undefined}
                    role="treeitem"
                >
                    {hasChildren
                        ? (
                            <span
                                className="shrink-0 size-4 hover:bg-foreground/10 rounded-sm grid place-items-center"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpanded(id);
                                }}
                            >
                                <ChevronRight className={classNames("size-3 transition-transform duration-150", isExpanded && "rotate-90")} />
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
