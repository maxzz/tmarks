import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/shadcn/dialog";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { cancelNewItemAtom, commitNewItemAtom, newItemDialogOpenAtom, newItemDraftAtom } from "@/store/new-items/1-new-item-atoms";
import { focusBookmarksArea } from "../2-main/0-all-main/8-bookmark-ui-helpers";

/** Dialog of "Add new folder" and "Add new bookmark". A bookmark without a name is named after its URL. */
export function NewItemDialog() {
    const open = useAtomValue(newItemDialogOpenAtom);
    const [draft, setDraft] = useAtom(newItemDraftAtom);
    const commit = useSetAtom(commitNewItemAtom);
    const cancel = useSetAtom(cancelNewItemAtom);

    const isLink = draft.kind === "link";
    const canSave = isLink ? draft.url.trim() !== "" : draft.title.trim() !== "";

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) cancel(); }}>
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
                    <DialogTitle className="text-sm">{isLink ? "New bookmark" : "New folder"}</DialogTitle>
                    <DialogDescription className="sr-only">Press Enter to add, or Escape to cancel.</DialogDescription>
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
                        <Label htmlFor="bookmark-new-name">Name</Label>
                        <Input
                            id="bookmark-new-name"
                            autoFocus
                            autoComplete="off"
                            placeholder={isLink ? "Same as the URL" : undefined}
                            value={draft.title}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        />
                    </div>

                    {isLink && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="bookmark-new-url">URL</Label>
                            <Input
                                id="bookmark-new-url"
                                autoComplete="off"
                                spellCheck={false}
                                placeholder="https://example.com"
                                value={draft.url}
                                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={cancel}>Cancel</Button>
                        <Button type="submit" disabled={!canSave}>Add</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
