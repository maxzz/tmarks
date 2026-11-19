import { useAtomValue, useSetAtom } from "jotai";
import { Menu, Save, Sparkles, Trash2, Upload } from "lucide-react";
import { MainPage, navigateToPageAtom } from "@/components/5-welcome/a-ui-app-page";
import { Button } from "@/ui/shadcn/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/ui/shadcn/dropdown-menu";
import { hasBookmarksAtom } from "@/store/store/a-bookmarks-atoms";
import { openImportPickerAtom, requestClearAtom, saveBookmarksAtom } from "@/store/store/a-bookmarks-actions";

export function TopMenu() {
    const hasBookmarks = useAtomValue(hasBookmarksAtom);
    const openImportPicker = useSetAtom(openImportPickerAtom);
    const save = useSetAtom(saveBookmarksAtom);
    const requestClear = useSetAtom(requestClearAtom);
    const navigate = useSetAtom(navigateToPageAtom);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button className="size-6 rounded" variant="ghost" size="icon" title="Menu" type="button">
                    <Menu className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="min-w-52">
                <DropdownMenuItem onSelect={() => openImportPicker()}>
                    <Upload />
                    Import bookmarks…
                </DropdownMenuItem>

                <DropdownMenuItem disabled={!hasBookmarks} onSelect={() => save()}>
                    <Save />
                    Save bookmarks…
                </DropdownMenuItem>

                <DropdownMenuItem disabled={!hasBookmarks} variant="destructive" onSelect={() => requestClear()}>
                    <Trash2 />
                    Clear all bookmarks…
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onSelect={() => navigate(MainPage.welcome)}>
                    <Sparkles />
                    Welcome page
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
