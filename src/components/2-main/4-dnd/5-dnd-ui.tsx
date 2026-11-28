import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { type DropTarget } from "./0-dnd-types";
import { dragSessionAtom, dropTargetAtom } from "./2-dnd-atoms";
import { previewX, previewY } from "./2-dnd-motion-values";

/** Drag feedback: the preview that follows the pointer, and the indicator of the drop target. Mount once, in the main area. */
export function BookmarkDndLayer() {
    return (<>
        <DropIndicator />
        <DragPreview />
    </>);
}

//---------------------------------------------------------------------------
// Preview

function DragPreview() {
    const session = useAtomValue(dragSessionAtom);

    return (
        <AnimatePresence>
            {session && <PreviewCard label={session.label} count={session.ids.length} />}
        </AnimatePresence>
    );
}

function PreviewCard({ label, count }: { label: string; count: number; }) {
    return (
        <motion.div
            className="fixed top-0 left-0 px-2 py-1 max-w-64 text-xs text-popover-foreground bg-popover border rounded-md shadow-lg flex items-center gap-2 pointer-events-none z-50"
            style={{ x: previewX, y: previewY }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.12 }}
        >
            <span className="min-w-0 truncate">{label}</span>
            {count > 1 && (
                <span className="shrink-0 px-1 text-primary-foreground bg-primary rounded-sm">{count}</span>
            )}
        </motion.div>
    );
}

//---------------------------------------------------------------------------
// Indicator

function DropIndicator() {
    const target = useAtomValue(dropTargetAtom);

    return (
        <AnimatePresence>
            {target && (
                <Indicator key={`${target.placement.kind}-${target.axis}`} target={target} />
            )}
        </AnimatePresence>
    );
}

/** A line for `before` and `after`, a box for `into` and `end`. The box and line slide to the new position with a spring. */
function Indicator({ target }: { target: DropTarget; }) {
    const geometry = indicatorGeometry(target);
    const isLine = target.placement.kind === "before" || target.placement.kind === "after";

    return (
        <motion.div
            className={isLine
                ? "fixed rounded-full bg-primary pointer-events-none z-40"
                : "fixed rounded border-2 1border-dashed border-primary bg-primary/5 pointer-events-none z-40"
            }
            initial={{ opacity: 0, ...geometry }}
            animate={{ opacity: 1, ...geometry }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 45 }}
        />
    );
}

/** Screen box of the indicator. A `before`/`after` line sits on the row's edge, 2px thick. */
function indicatorGeometry(target: DropTarget): { left: number; top: number; width: number; height: number; } {
    const { left, top, width, height } = target.rect;
    const { kind } = target.placement;
    if (kind === "into" || kind === "end") {
        return { left, top, width, height };
    }

    const before = kind === "before";
    if (target.axis === "x") {
        return { left: before ? left - 1 : left + width - 1, top, width: 2, height };
    }
    return { left, top: before ? top - 1 : top + height - 1, width, height: 2 };
}
