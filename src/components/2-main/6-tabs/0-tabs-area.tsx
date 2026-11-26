import { type ReactNode } from "react";
import { useAtomValue } from "jotai";
import { tabsRestoredAtom } from "@/store/tabs";
import { TabStrip } from "./1-tab-strip";

/**
 * The tab strip above the bookmarks area. The area shows the tab that is selected in the strip. Nothing is shown
 * until the tabs of the last session are read, so an empty page does not flash before them.
 */
export function TabsArea({ children }: { children: ReactNode; }) {
    const restored = useAtomValue(tabsRestoredAtom);
    if (!restored) {
        return null;
    }

    return (
        <div className="h-full min-h-0 flex flex-col">
            <TabStrip />
            <div className="min-h-0 flex-1">
                {children}
            </div>
        </div>
    );
}
