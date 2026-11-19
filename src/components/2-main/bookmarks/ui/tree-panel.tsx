import { useAtomValue, useSetAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { classNames } from "@/utils";
import { type BookmarkId } from "@/store/store/9-bookmark-types";
import { childFolderIdsAtom, isExpandedAtom, isSelectedAtom, nodeAtom, rootFolderIdsAtom } from "@/store/store/a-bookmarks-atoms";
import { clickItemAtom, toggleExpandedAtom } from "@/store/store/a-bookmarks-actions";
import { BookmarkContextMenu } from "../context-menu/bookmark-context-menu";
import { ItemPreview } from "./item-preview";
import { revealWhenSelected } from "./bookmark-ui-helpers";

/** The folder tree. Only folders appear here; links are listed in the right panel. */
export function TreePanel() {
    const rootIds = useAtomValue(rootFolderIdsAtom);

    return (
        <div role="tree" aria-label="Bookmarks" className="py-1 h-full select-none overflow-auto">
            {rootIds.map((id) => (
                <TreeRow key={id} id={id} depth={0} />
            ))}
        </div>
    );
}

function TreeRow({ id, depth }: { id: BookmarkId; depth: number; }) {
    const node = useAtomValue(nodeAtom(id));
    const childFolderIds = useAtomValue(childFolderIdsAtom(id));
    const isExpanded = useAtomValue(isExpandedAtom(id));
    const isSelected = useAtomValue(isSelectedAtom(id));
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
                    role="treeitem"
                    aria-selected={isSelected}
                    aria-expanded={hasChildren ? isExpanded : undefined}
                    tabIndex={-1}
                    ref={revealWhenSelected(isSelected)}
                    title={node.title}
                    style={{ paddingLeft: `${depth * 0.75 + 0.375}rem` }}
                    className={classNames(
                        "pr-2 py-1 hover:bg-muted outline-none flex items-center gap-1.5 cursor-default",
                        isSelected && "text-foreground bg-primary/15",
                    )}
                    onClick={(e) => clickItem({ id, scope: "tree", ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })}
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

                    <ItemPreview node={node} className="size-4" />

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
