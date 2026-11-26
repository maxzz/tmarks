import { useAtomValue, useSetAtom } from "jotai";
import { ChartColumn, Menu, Plus, Save, Sparkles, Trash2, Upload, X } from "lucide-react";
import { MainPage, navigateToPageAtom } from "@/components/5-welcome/a-ui-app-page";
import { isOpenStatisticsDialogAtom } from "@/components/4-dialogs/8-4-statistics/9-types-statistics";
import { Button } from "@/ui/shadcn/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/ui/shadcn/dropdown-menu";
import { hasBookmarksAtom } from "@/store/store/a-bookmarks-atoms";
import { openImportPickerAtom, requestClearAtom } from "@/store/store/a-bookmarks-actions";
import { newTabAtom, requestCloseActiveTabAtom, saveActiveTabAtom } from "@/store/tabs";

export function TopMenu() {
    const hasBookmarks = useAtomValue(hasBookmarksAtom);
    const openImportPicker = useSetAtom(openImportPickerAtom);
    const newTab = useSetAtom(newTabAtom);
    const save = useSetAtom(saveActiveTabAtom);
    const closeTab = useSetAtom(requestCloseActiveTabAtom);
    const requestClear = useSetAtom(requestClearAtom);
    const navigate = useSetAtom(navigateToPageAtom);
    const openStatistics = useSetAtom(isOpenStatisticsDialogAtom);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button className="size-6 rounded" variant="ghost" size="icon" title="Menu" type="button">
                    <Menu className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="min-w-52">
                <DropdownMenuItem onSelect={() => newTab()}>
                    <Plus />
                    New tab
                </DropdownMenuItem>

                <DropdownMenuItem onSelect={() => openImportPicker()}>
                    <Upload />
                    Import bookmarks…
                </DropdownMenuItem>

                <DropdownMenuItem disabled={!hasBookmarks} onSelect={() => save()}>
                    <Save />
                    Save bookmarks…
                </DropdownMenuItem>

                <DropdownMenuItem onSelect={() => closeTab()}>
                    <X />
                    Close tab
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem disabled={!hasBookmarks} variant="destructive" onSelect={() => requestClear()}>
                    <Trash2 />
                    Clear all bookmarks…
                </DropdownMenuItem>

                <DropdownMenuItem onSelect={() => openStatistics(true)}>
                    <ChartColumn />
                    Statistics…
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
