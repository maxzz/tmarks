import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/shadcn/dialog";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { editDraftAtom, editingIdAtom } from "../store/bookmarks-atoms";
import { cancelEditAtom, commitEditAtom } from "../store/bookmarks-actions";
import { focusBookmarksArea } from "./bookmark-ui-helpers";

/** Dialog opened with F2 on the selected item. Edits its name and, for bookmarks, its URL. */
export function EditItemDialog() {
    const editingId = useAtomValue(editingIdAtom);
    const [draft, setDraft] = useAtom(editDraftAtom);
    const commit = useSetAtom(commitEditAtom);
    const cancel = useSetAtom(cancelEditAtom);

    const isLink = draft.isLink;
    const canSave = draft.title.trim() !== "" && (!isLink || draft.url.trim() !== "");

    return (
        <Dialog open={editingId !== null} onOpenChange={(open) => { if (!open) cancel(); }}>
            <DialogContent
                className="p-0! max-w-sm! gap-0!"
                modal
                // Keyboard shortcuts (F2, arrows) work only inside the bookmarks area, so give it focus back.
                onCloseAutoFocus={(e) => {
                    e.preventDefault();
                    focusBookmarksArea();
                }}
            >
                <DialogHeader className="px-4 py-3 text-left border-b gap-0">
                    <DialogTitle className="text-sm">{isLink ? "Edit bookmark" : "Edit folder"}</DialogTitle>
                    <DialogDescription className="sr-only">Press Enter to save, or Escape to cancel.</DialogDescription>
                </DialogHeader>

                <form
                    className="px-4 py-4 flex flex-col gap-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (canSave) {
                            commit();
                        }
                    }}
                >
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bookmark-edit-name">Name</Label>
                        <Input
                            id="bookmark-edit-name"
                            autoFocus
                            autoComplete="off"
                            value={draft.title}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        />
                    </div>

                    {isLink && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="bookmark-edit-url">URL</Label>
                            <Input
                                id="bookmark-edit-url"
                                autoComplete="off"
                                spellCheck={false}
                                value={draft.url}
                                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={cancel}>Cancel</Button>
                        <Button type="submit" disabled={!canSave}>Save</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
