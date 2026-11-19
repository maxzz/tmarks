import { useAtom } from "jotai";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { viewModeAtom } from "@/store/store/a-bookmarks-atoms";

/** Switches the right panel between a list and a grid. */
export function ViewModeToggle() {
    const [viewMode, setViewMode] = useAtom(viewModeAtom);
    const isGrid = viewMode === "grid";

    return (
        <Button
            className="size-6 rounded"
            variant="ghost"
            size="icon"
            title={isGrid ? "Show as list" : "Show as grid"}
            aria-pressed={isGrid}
            onClick={() => setViewMode(isGrid ? "list" : "grid")}
            type="button"
        >
            {isGrid
                ? <List className="size-3.5" />
                : <LayoutGrid className="size-3.5" />
            }
        </Button>
    );
}
