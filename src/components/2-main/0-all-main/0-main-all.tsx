import { useAtomValue, useSetAtom } from "jotai";
import { Bookmark } from "lucide-react";
import { type Layout } from "react-resizable-panels";
import { appSettings } from "@/store/1-ui-settings";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/ui/shadcn/resizable";
import { bookmarksKeyDownAtom } from "../a-main-atoms";
import { hasBookmarksAtom } from "@/store/store/a-bookmarks-atoms";
import { TreePanel } from "../2-tree/tree-panel";
import { ItemsPanel } from "../3-items/items-panel";

/** Two panels: the folder tree on the left, the items of the selected folder on the right. */
export function MainBody() {
    const hasBookmarks = useAtomValue(hasBookmarksAtom);
    const onKeyDown = useSetAtom(bookmarksKeyDownAtom);

    return (
        <div data-bookmarks-area tabIndex={0} onKeyDown={onKeyDown} className="h-full min-h-0 outline-none">
            {hasBookmarks
                ? <PanelsLayout />
                : <EmptyState />
            }

        </div>
    );
}

/** The folder tree on the left and the items of the selected folder on the right, with a resizable split. */
function PanelsLayout() {
    return (
        <ResizablePanelGroup
            orientation="horizontal"
            defaultLayout={appSettings.panelSizes.horizontal as Layout}
            onLayoutChanged={(layout: Layout) => {
                appSettings.panelSizes = { ...appSettings.panelSizes, horizontal: layout };
            }}
        >
            <ResizablePanel id="left" minSize={15} className="min-w-0 overflow-hidden">
                <TreePanel />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel id="right" minSize={30} className="min-w-0 overflow-hidden">
                <ItemsPanel />
            </ResizablePanel>
        </ResizablePanelGroup>
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
