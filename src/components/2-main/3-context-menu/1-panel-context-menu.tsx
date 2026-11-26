import { type ReactNode } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { BookmarkPlus, ClipboardPaste, FolderPlus, Plus, Upload } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/ui/shadcn/context-menu";
import { currentFolderIdAtom } from "@/store/store/a-bookmarks-atoms";
import { openImportPickerAtom } from "@/store/store/a-bookmarks-actions";
import { newTabAtom } from "@/store/tabs";
import { startNewItemInPanelAtom } from "@/store/new-items/1-new-item-atoms";
import { clipboardAtom } from "../5-clipboard/1-clipboard-atoms";
import { pasteIntoPanelAtom, restoreFocusAfterContextMenuAtom } from "./a-bookmark-context-actions";
import { type BookmarkContextScope } from "./0-context-menu";

/**
 * Wraps a whole panel, so a right-click anywhere in it opens the app's menu, also below the last row. A row's own
 * menu (BookmarkContextMenu) takes the click first, so this menu opens only on the panel's empty space.
 */
export function PanelContextMenu({ scope, children }: { scope: BookmarkContextScope; children: ReactNode; }) {
    const restoreFocus = useSetAtom(restoreFocusAfterContextMenuAtom);

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

            <ContextMenuContent onCloseAutoFocus={(e) => { e.preventDefault(); restoreFocus(); }}>
                {/* Read only while open: Radix mounts the content only when the menu is shown. */}
                <PanelContextMenuItems scope={scope} />
            </ContextMenuContent>
        </ContextMenu>
    );
}

function PanelContextMenuItems({ scope }: { scope: BookmarkContextScope; }) {
    const clipboard = useAtomValue(clipboardAtom);
    const folderId = useAtomValue(currentFolderIdAtom);
    const paste = useSetAtom(pasteIntoPanelAtom);
    const openImportPicker = useSetAtom(openImportPickerAtom);
    const newTab = useSetAtom(newTabAtom);
    const startNewItem = useSetAtom(startNewItemInPanelAtom);

    // The right panel shows no folder when nothing is selected in the tree, so there is nowhere to add or paste.
    const hasPlace = scope === "tree" || folderId !== null;
    const canPaste = clipboard !== null && hasPlace;

    return (<>
        <ContextMenuItem disabled={!hasPlace} onSelect={() => startNewItem({ kind: "folder", scope })}>
            <FolderPlus />
            Add new folder
        </ContextMenuItem>
        {scope === "items" && (
            <ContextMenuItem disabled={!hasPlace} onSelect={() => startNewItem({ kind: "link", scope })}>
                <BookmarkPlus />
                Add new bookmark
            </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem disabled={!canPaste} onSelect={() => paste(scope)}>
            <ClipboardPaste />
            {scope === "tree" ? "Paste at the top level" : "Paste"}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={() => openImportPicker()}>
            <Upload />
            Import bookmarks…
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => newTab()}>
            <Plus />
            New tab
        </ContextMenuItem>
    </>);
}
