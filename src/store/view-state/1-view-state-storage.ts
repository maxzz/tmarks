import { parseViewState, type ViewState } from "./0-view-state-logic";

// The saved view lives under its own key, not in the bookmark tree. That way it can be written without rewriting the tree.

const VIEW_KEY = "tm-tmarks-view-v1";

/** Reads the saved view, or `null` when there is none or it cannot be read. */
export function readStoredViewState(): ViewState | null {
    try {
        const raw = localStorage.getItem(VIEW_KEY);
        return raw ? parseViewState(JSON.parse(raw)) : null;
    } catch (e) {
        console.error("Failed to read the saved view", e);
        return null;
    }
}

/** Saves the view. A failed write is logged only: the view is a convenience, and the tree is kept separately. */
export function writeStoredViewState(state: ViewState): void {
    try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(state));
    } catch (e) {
        console.error("Failed to save the view", e);
    }
}
