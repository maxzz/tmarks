import { useAtomValue, useSetAtom } from "jotai";
import { Plus, X } from "lucide-react";
import { classNames } from "@/utils";
import { isActiveTabAtom, isTabModifiedAtom, requestCloseTabAtom, type TabInfo, tabsAtom } from "@/store/tabs";
import { auxClickTabAtom, clickNewTabAtom, clickTabAtom } from "./a-tabs-ui-atoms";

/**
 * One header per open bookmarks file. Dragged items can be dropped on a header, or rest on it to show that tab
 * (the data-dnd-* attributes, see 4-dnd).
 */
export function TabStrip() {
    const tabs = useAtomValue(tabsAtom);
    const newTab = useSetAtom(clickNewTabAtom);

    return (
        <div className="px-1 pt-1 bg-muted/40 [&::-webkit-scrollbar]:hidden border-b overflow-x-auto flex items-end gap-px scrollbar-none" role="tablist" aria-label="Open bookmark files">
            {tabs.map(
                (tab) => <TabHeader key={tab.id} tab={tab} />
            )}

            <button
                className="shrink-0 mb-0.5 ml-1 size-6 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-sm grid place-items-center"
                type="button"
                title="New tab"
                onClick={() => newTab()}
            >
                <Plus className="size-3.5" />
            </button>
        </div>
    );
}

function TabHeader({ tab }: { tab: TabInfo; }) {
    const isActive = useAtomValue(isActiveTabAtom(tab.id));
    const isModified = useAtomValue(isTabModifiedAtom(tab.id));
    const click = useSetAtom(clickTabAtom);
    const auxClick = useSetAtom(auxClickTabAtom);
    const requestClose = useSetAtom(requestCloseTabAtom);

    return (
        <div
            className={classNames(
                "shrink-0 pl-3 pr-1 h-7 min-w-24 max-w-52 border border-b-0 rounded-t-md select-none flex items-center gap-1.5 cursor-default -mb-px",
                isActive
                    ? "text-foreground bg-background border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent",
            )}
            role="tab"
            aria-selected={isActive}
            title={tab.fileName ?? tab.title}
            data-dnd-target="tab"
            data-dnd-tab-id={tab.id}
            onClick={() => click(tab.id)}
            onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }}
            onAuxClick={(e) => auxClick({ tabId: tab.id, button: e.button })}
        >
            <span className="flex-1 min-w-0 truncate">{tab.title}</span>

            {isModified && (
                <span className="shrink-0 size-1.5 bg-primary rounded-full" title="Changed since it was opened or saved" />
            )}

            <button
                className="shrink-0 size-4 opacity-60 hover:opacity-100 hover:bg-foreground/10 rounded-sm grid place-items-center"
                type="button"
                title="Close tab"
                onClick={(e) => {
                    e.stopPropagation();
                    requestClose(tab.id);
                }}
            >
                <X className="size-3" />
            </button>
        </div>
    );
}
