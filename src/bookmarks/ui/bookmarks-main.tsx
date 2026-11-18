import { type KeyboardEvent } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Bookmark } from "lucide-react";
import { type Layout } from "react-resizable-panels";
import { appSettings } from "@/store/1-ui-settings";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/ui/shadcn/resizable";
import { hasBookmarksAtom } from "../store/bookmarks-atoms";
import { navigateTreeKeyAtom, requestDeleteSelectedAtom, startEditSelectedAtom } from "../store/bookmarks-actions";
import { TreePanel } from "./tree-panel";
import { ItemsPanel } from "./items-panel";
import { EditItemDialog } from "./edit-item-dialog";

/** Two panels: the folder tree on the left, the items of the selected folder on the right. */
export function BookmarksMain() {
    const hasBookmarks = useAtomValue(hasBookmarksAtom);
    const startEdit = useSetAtom(startEditSelectedAtom);
    const navigateTree = useSetAtom(navigateTreeKeyAtom);
    const requestDelete = useSetAtom(requestDeleteSelectedAtom);

    function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        // Ignore keys typed into fields, and keys from portaled menus/dialogs that are not inside this area.
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
            return;
        }
        if (!event.currentTarget.contains(event.target as Node)) {
            return;
        }

        switch (event.key) {
            case "F2":
                event.preventDefault();
                startEdit();
                break;
            case "Delete":
            case "Backspace":
                event.preventDefault();
                requestDelete();
                break;
            case "ArrowUp":
            case "ArrowDown":
            case "ArrowLeft":
            case "ArrowRight":
                event.preventDefault();
                navigateTree(event.key);
                break;
        }
    }

    return (
        <div data-bookmarks-area tabIndex={0} onKeyDown={onKeyDown} className="h-full min-h-0 outline-none">
            {hasBookmarks
                ? (
                    <ResizablePanelGroup
                        orientation="horizontal"
                        defaultLayout={appSettings.panelSizes.horizontal as Layout}
                        onLayoutChanged={(layout: Layout) => {
                            appSettings.panelSizes = { ...appSettings.panelSizes, horizontal: layout };
                        }}
                    >
                        <ResizablePanel id="left" minSize={15}>
                            <TreePanel />
                        </ResizablePanel>

                        <ResizableHandle withHandle />

                        <ResizablePanel id="right" minSize={30}>
                            <ItemsPanel />
                        </ResizablePanel>
                    </ResizablePanelGroup>
                )
                : <EmptyState />
            }

            <EditItemDialog />
        </div>
    );
}

function EmptyState() {
    return (
        <div className="p-8 h-full text-center grid place-items-center">
            <div className="max-w-sm text-muted-foreground gap-2 flex flex-col items-center">
                <Bookmark className="size-10" strokeWidth={1.25} />
                <p className="text-sm font-medium text-foreground">No bookmarks loaded</p>
                <p>Drop a bookmarks .html file exported from Chrome or Opera anywhere on this page, or choose Import bookmarks from the menu.</p>
            </div>
        </div>
    );
}
