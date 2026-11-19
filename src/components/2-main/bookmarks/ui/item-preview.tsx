import { Folder, Globe } from "lucide-react";
import { classNames } from "@/utils";
import { type BookmarkNode } from "../model/9-bookmark-types";

/**
 * Preview of one item: the browser's inline icon (ICON) for bookmarks, a folder glyph for folders.
 * If the image is missing or fails to decode, the glyph underneath stays visible.
 */
export function ItemPreview({ node, className }: { node: BookmarkNode; className?: string; }) {
    const icon = node.kind === "link" ? node.icon : null;

    return (
        <span className={classNames("shrink-0 relative text-muted-foreground overflow-hidden grid place-items-center", className)} aria-hidden>
            {node.kind === "folder"
                ? <Folder className="size-[70%] fill-muted-foreground/20" strokeWidth={1.5} />
                : <Globe className="size-[70%]" strokeWidth={1.5} />
            }

            {icon && (
                <img
                    className="absolute inset-0 size-full object-contain"
                    src={icon}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                        e.currentTarget.hidden = true;
                    }}
                />
            )}
        </span>
    );
}
