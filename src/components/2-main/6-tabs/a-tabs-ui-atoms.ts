import { atom } from "jotai";
import { activateTabAtom, newTabAtom, requestCloseTabAtom, type TabId } from "@/store/tabs";
import { focusBookmarksArea } from "../0-all-main/8-bookmark-ui-helpers";

// Tab strip actions. A click on the strip takes focus from the bookmarks area, so each action gives it back:
// the keyboard shortcuts (copy, paste, undo, arrows) work only there.

export const clickTabAtom = atom(
    null,
    (_get, set, tabId: TabId) => {
        set(activateTabAtom, tabId);
        focusBookmarksArea();
    }
);

export const clickNewTabAtom = atom(
    null,
    (_get, set) => {
        set(newTabAtom);
        focusBookmarksArea();
    }
);

/** A middle-click on a tab closes it, as in browsers. */
export const auxClickTabAtom = atom(
    null,
    (_get, set, { tabId, button }: { tabId: TabId; button: number; }) => {
        if (button === 1) {
            set(requestCloseTabAtom, tabId);
        }
    }
);
