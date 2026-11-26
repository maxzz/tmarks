import { useAtomValue, useSetAtom } from "jotai";
import { Button } from "@/ui/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/shadcn/dialog";
import {
    clearDialogOpenAtom,
    deleteDialogOpenAtom,
    pendingDeleteIdsAtom,
} from "@/store/store/a-bookmarks-atoms";
import {
    cancelClearAtom,
    cancelDeleteAtom,
    confirmClearAtom,
    confirmDeleteAtom,
} from "@/store/store/a-bookmarks-actions";
import { focusBookmarksArea } from "../2-main/0-all-main/8-bookmark-ui-helpers";
import { CloseTabDialog } from "../2-main/6-tabs/2-close-tab-dialog";
import { EditItemDialog } from "./1-edit-item-dialog";

/** Confirmation and choice dialogs of the bookmarks area. Rendered at app level, so they also work over the Welcome page. */
export function BookmarkDialogs() {
    return (<>
        <DeleteDialog />
        <ClearDialog />
        <EditItemDialog />
        <CloseTabDialog />
    </>);
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