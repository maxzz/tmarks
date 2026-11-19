import { type ReactNode } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { ExternalLink, Pencil, Trash } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/ui/shadcn/context-menu";
import { type BookmarkId } from "@/store/store/9-bookmark-types";
import { nodeAtom } from "@/store/store/a-bookmarks-atoms";
import { openBookmarkLink } from "../0-all-main/8-bookmark-ui-helpers";
import { deleteContextItemAtom, editContextItemAtom, restoreFocusAfterContextMenuAtom } from "./a-bookmark-context-actions";

/**
 * Where the item is shown. The tree (`"tree"`, left) offers only "Delete".
 * The item list (`"items"`, right) offers "Open in new tab" (links only), "Edit" and "Delete".
 */
export type BookmarkContextScope = "tree" | "items";

/** Wraps one row or card. The wrapped element is the trigger, so right-clicking it opens this item's menu. */
export function BookmarkContextMenu({ id, scope, children }: { id: BookmarkId; scope: BookmarkContextScope; children: ReactNode; }) {
    const restoreFocus = useSetAtom(restoreFocusAfterContextMenuAtom);

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

            <ContextMenuContent onCloseAutoFocus={(e) => { e.preventDefault(); restoreFocus(); }}>
                {/* Read only while open: Radix mounts the content only when the menu is shown. */}
                <BookmarkContextMenuItems id={id} scope={scope} />
            </ContextMenuContent>
        </ContextMenu>
    );
}

function BookmarkContextMenuItems({ id, scope }: { id: BookmarkId; scope: BookmarkContextScope; }) {
    const node = useAtomValue(nodeAtom(id));
    const edit = useSetAtom(editContextItemAtom);
    const remove = useSetAtom(deleteContextItemAtom);

    if (!node) {
        return null;
    }

    const isItemList = scope === "items";

    return (<>
        {isItemList && node.kind === "link" && (
            <ContextMenuItem onSelect={() => openBookmarkLink(node.url)}>
                <ExternalLink />
                Open in new tab
            </ContextMenuItem>
        )}

        {isItemList && (
            <ContextMenuItem onSelect={() => edit(id)}>
                <Pencil />
                Edit
            </ContextMenuItem>
        )}

        {isItemList && <ContextMenuSeparator />}

        <ContextMenuItem variant="destructive" onSelect={() => remove(id)}>
            <Trash />
            Delete
        </ContextMenuItem>
    </>);
}
