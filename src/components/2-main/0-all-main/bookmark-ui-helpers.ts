import { notice } from "@/ui/local-ui/7-toaster";

/** Opens a bookmark in a new tab. Only web addresses are opened, so a bookmark cannot run `javascript:` code. */
export function openBookmarkLink(url: string): void {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        notice.info(`Invalid address: ${url}`);
        return;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        notice.info(`Only http and https addresses can be opened: ${url}`);
        return;
    }

    window.open(parsed.href, "_blank", "noopener,noreferrer");
}

/**
 * Gives keyboard focus back to the bookmarks area after a dialog closes. The area handles F2, arrows and Delete,
 * so without this the keys stop working once a dialog has closed.
 */
export function focusBookmarksArea(): void {
    document.querySelector<HTMLElement>("[data-bookmarks-area]")?.focus({ preventScroll: true });
}

/**
 * Ref callback for a row: keeps the selected row in view when it changes (e.g. after arrow keys).
 * Returns `undefined` for rows that are not selected, so they get no ref work.
 */
export function revealWhenSelected(isSelected: boolean): ((el: HTMLElement | null) => void) | undefined {
    return isSelected
        ? (el) => {
            el?.scrollIntoView({ block: "nearest" });
        }
        : undefined;
}
