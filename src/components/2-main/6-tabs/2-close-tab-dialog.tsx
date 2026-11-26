import { useAtomValue, useSetAtom } from "jotai";
import { Button } from "@/ui/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/shadcn/dialog";
import { cancelCloseTabAtom, closeTabDialogOpenAtom, discardAndCloseTabAtom, pendingCloseTabAtom, saveAndCloseTabAtom } from "@/store/tabs";
import { focusBookmarksArea } from "../0-all-main/8-bookmark-ui-helpers";

/** Asked before a tab with changes not saved to a file is closed. Its content is kept until the dialog has closed. */
export function CloseTabDialog() {
    const open = useAtomValue(closeTabDialogOpenAtom);
    const tab = useAtomValue(pendingCloseTabAtom);
    const cancel = useSetAtom(cancelCloseTabAtom);
    const discard = useSetAtom(discardAndCloseTabAtom);
    const save = useSetAtom(saveAndCloseTabAtom);

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) cancel(); }}>
            <DialogContent className="p-0! max-w-sm! gap-0!" modal onCloseAutoFocus={(e) => { e.preventDefault(); focusBookmarksArea(); }}>
                <DialogHeader className="px-4 py-3 text-left border-b gap-0">
                    <DialogTitle className="text-sm">Save changes to "{tab?.title}"?</DialogTitle>
                    <DialogDescription className="text-xs">
                        This tab has changes that were not saved to a file. They are lost when the tab is closed.
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="px-4 py-3 flex flex-row justify-end gap-2">
                    <Button type="button" variant="outline" onClick={cancel}>Cancel</Button>
                    <Button type="button" variant="destructive" onClick={() => discard()}>Don't save</Button>
                    <Button type="button" autoFocus onClick={() => save()}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
