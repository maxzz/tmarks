import { useAtomValue, useSetAtom } from "jotai";
import { Button } from "@/ui/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/shadcn/dialog";
import { type BookmarkNode } from "../2-main/bookmarks/model/bookmark-types";
import {
    bookmarkNodesAtom,
    clearDialogOpenAtom,
    deleteDialogOpenAtom,
    importDialogOpenAtom,
    pendingDeleteIdsAtom,
    pendingImportAtom,
} from "../2-main/bookmarks/store/bookmarks-atoms";
import {
    appendImportAtom,
    cancelClearAtom,
    cancelDeleteAtom,
    cancelImportAtom,
    confirmClearAtom,
    confirmDeleteAtom,
    replaceWithImportAtom,
} from "../2-main/bookmarks/store/bookmarks-actions";
import { focusBookmarksArea } from "../2-main/bookmarks/ui/bookmark-ui-helpers";
import { EditItemDialog } from "../2-main/bookmarks/ui/edit-item-dialog";

/** Confirmation and choice dialogs of the bookmarks area. Rendered at app level, so they also work over the Welcome page. */
export function BookmarkDialogs() {
    return (<>
        <ImportDialog />
        <DeleteDialog />
        <ClearDialog />
        <EditItemDialog />
    </>);
}

/** Shown when files are imported while bookmarks are already loaded: replace them, or add the files as folders. */
function ImportDialog() {
    const open = useAtomValue(importDialogOpenAtom);
    const pending = useAtomValue(pendingImportAtom);
    const nodes = useAtomValue(bookmarkNodesAtom);
    const cancel = useSetAtom(cancelImportAtom);
    const append = useSetAtom(appendImportAtom);
    const replace = useSetAtom(replaceWithImportAtom);

    const loadedCount = countLinks(Object.values(nodes));
    const importedCount = countLinks(pending.flatMap((entry) => Object.values(entry.doc.nodes)));
    const names = pending.map((entry) => `"${entry.name}"`).join(", ");
    const plural = pending.length > 1;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) cancel(); }}>
            <DialogContent className="p-0! max-w-md! gap-0!" modal onCloseAutoFocus={(e) => { e.preventDefault(); focusBookmarksArea(); }}>
                <DialogHeader className="px-4 py-3 text-left border-b gap-0">
                    <DialogTitle className="text-sm">Bookmarks are already loaded</DialogTitle>
                    <DialogDescription className="sr-only">Choose whether to replace the loaded bookmarks or add the imported ones.</DialogDescription>
                </DialogHeader>

                <div className="px-4 py-4 text-sm flex flex-col gap-2">
                    <p>
                        You have {loadedCount} {loadedCount === 1 ? "bookmark" : "bookmarks"} loaded.
                        {" "}{names} {plural ? "contain" : "contains"} {importedCount} {importedCount === 1 ? "bookmark" : "bookmarks"}.
                    </p>
                    <p className="text-muted-foreground">
                        Replace the loaded bookmarks with {plural ? "these files" : "this file"}, or add {plural ? "each file" : "the file"} as a folder at the end of the list.
                    </p>
                </div>

                <DialogFooter className="px-4 py-3 border-t flex flex-row justify-end gap-2">
                    <Button type="button" variant="outline" onClick={cancel}>Cancel</Button>
                    <Button type="button" variant="secondary" onClick={() => append()}>Add as folder</Button>
                    <Button type="button" variant="destructive" onClick={() => replace()}>Replace</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Confirms deleting the selected items. Deleting a folder also deletes everything inside it. */
function DeleteDialog() {
    const open = useAtomValue(deleteDialogOpenAtom);
    const ids = useAtomValue(pendingDeleteIdsAtom);
    const cancel = useSetAtom(cancelDeleteAtom);
    const confirm = useSetAtom(confirmDeleteAtom);

    const count = ids.length;
    const title = count === 1 ? "Delete this item?" : `Delete ${count} items?`;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) cancel(); }}>
            <DialogContent className="p-0! max-w-sm! gap-0!" modal onCloseAutoFocus={(e) => { e.preventDefault(); focusBookmarksArea(); }}>
                <DialogHeader className="px-4 py-3 text-left border-b gap-0">
                    <DialogTitle className="text-sm">{title}</DialogTitle>
                    <DialogDescription className="text-xs">Folders are deleted together with everything inside them.</DialogDescription>
                </DialogHeader>

                <DialogFooter className="px-4 py-3 flex flex-row justify-end gap-2">
                    <Button type="button" variant="outline" onClick={cancel}>Cancel</Button>
                    <Button type="button" variant="destructive" autoFocus onClick={() => confirm()}>Delete</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Confirms removing every bookmark and folder. */
function ClearDialog() {
    const open = useAtomValue(clearDialogOpenAtom);
    const cancel = useSetAtom(cancelClearAtom);
    const confirm = useSetAtom(confirmClearAtom);

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) cancel(); }}>
            <DialogContent className="p-0! max-w-sm! gap-0!" modal onCloseAutoFocus={(e) => { e.preventDefault(); focusBookmarksArea(); }}>
                <DialogHeader className="px-4 py-3 text-left border-b gap-0">
                    <DialogTitle className="text-sm">Clear all bookmarks?</DialogTitle>
                    <DialogDescription className="text-xs">Every bookmark and folder will be removed. Save the bookmarks first if you want to keep them.</DialogDescription>
                </DialogHeader>

                <DialogFooter className="px-4 py-3 flex flex-row justify-end gap-2">
                    <Button type="button" variant="outline" onClick={cancel}>Cancel</Button>
                    <Button type="button" variant="destructive" onClick={() => confirm()}>Clear all</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function countLinks(nodes: BookmarkNode[]): number {
    return nodes.filter((node) => node.kind === "link").length;
}
