import { type ReactNode } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { ClipboardPaste, Copy, Download, ExternalLink, Pencil, Scissors, Trash } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/ui/shadcn/context-menu";
import { type BookmarkId } from "@/store/store/9-bookmark-types";
import { nodeAtom } from "@/store/store/a-bookmarks-atoms";
import { openBookmarkLink } from "../0-all-main/8-bookmark-ui-helpers";
import { clipboardAtom } from "../5-clipboard/1-clipboard-atoms";
import {
    copyContextItemAtom,
    cutContextItemAtom,
    deleteContextItemAtom,
    editContextItemAtom,
    exportContextItemAtom,
    pasteContextItemAtom,
    restoreFocusAfterContextMenuAtom,
    type ContextTarget,
} from "./a-bookmark-context-actions";

/**
 * Where the item is shown. The tree (`"tree"`, left) offers Cut, Copy, Paste, Export and Delete. The item list
 * (`"items"`, right) adds "Edit" and "Open in new tab" (links only).
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
    const clipboard = useAtomValue(clipboardAtom);
    const edit = useSetAtom(editContextItemAtom);
    const cut = useSetAtom(cutContextItemAtom);
    const copy = useSetAtom(copyContextItemAtom);
    const paste = useSetAtom(pasteContextItemAtom);
    const exportItems = useSetAtom(exportContextItemAtom);
    const remove = useSetAtom(deleteContextItemAtom);

    if (!node) {
        return null;
    }

    const target: ContextTarget = { id, scope };
    const isItemList = scope === "items";

    return (<>
        {isItemList && (
            <ContextMenuItem onSelect={() => edit(id)}>
                <Pencil className="p-px" />
                Edit
            </ContextMenuItem>
        )}

        {isItemList && node.kind === "link" && (
            <ContextMenuItem onSelect={() => openBookmarkLink(node.url)}>
                <ExternalLink />
                Open in new tab
            </ContextMenuItem>
        )}

        {isItemList && <ContextMenuSeparator />}

        <ContextMenuItem onSelect={() => cut(target)}>
            <Scissors />
            Cut
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => copy(target)}>
            <Copy />
            Copy
        </ContextMenuItem>
        <ContextMenuItem disabled={clipboard === null} onSelect={() => paste(id)}>
            <ClipboardPaste />
            Paste
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={() => exportItems(target)}>
            <Download />
            Export
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem variant="destructive" onSelect={() => remove(target)}>
            <Trash />
            Delete
        </ContextMenuItem>
    </>);
}
