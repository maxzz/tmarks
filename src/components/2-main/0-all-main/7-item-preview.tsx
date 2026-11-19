import { useState } from "react";
import { Folder, Globe } from "lucide-react";
import { useAtomValue } from "jotai";
import { classNames } from "@/utils";
import { type BookmarkNode } from "@/store/store/9-bookmark-types";
import { itemIconAtom } from "@/store/store/a-bookmarks-atoms";

/**
 * Preview of one item: the browser's icon for bookmarks (from the icon cache), a folder glyph for folders.
 * The glyph is shown only when there is no icon or the icon fails to load. It is not drawn under the icon,
 * because transparent icons would show it through.
 */
export function ItemPreview({ node, className }: { node: BookmarkNode; className?: string; }) {
    const icon = useAtomValue(itemIconAtom(node.id));
    // The icon that failed to load. Keyed by the icon itself, so a different icon gets a fresh attempt.
    const [failedIcon, setFailedIcon] = useState<string | null>(null);
    const showIcon = icon !== null && icon !== failedIcon;

    return (
        <span className={classNames("relative shrink-0 text-muted-foreground overflow-hidden grid place-items-center", className)} aria-hidden>
            {showIcon
                ? (
                    <img
                        className="absolute inset-0 size-full object-contain"
                        src={icon}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={() => setFailedIcon(icon)}
                    />
                )
                : node.kind === "folder"
                    ? <Folder className="size-[70%] fill-muted-foreground/20" strokeWidth={1.5} />
                    : <Globe className="size-[70%]" strokeWidth={1.5} />
            }
        </span>
    );
}
