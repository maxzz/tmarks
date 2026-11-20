import { useAtomValue, useSetAtom } from "jotai";
import { Redo2, Undo2 } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { canRedoAtom, canUndoAtom, redoAtom, undoAtom } from "@/store/history/1-history-atoms";

/** Undo and redo, next to the main menu. Each is disabled when there is no step to take. */
export function UndoRedoButtons() {
    const canUndo = useAtomValue(canUndoAtom);
    const canRedo = useAtomValue(canRedoAtom);
    const undo = useSetAtom(undoAtom);
    const redo = useSetAtom(redoAtom);

    return (
        <div className="flex items-center gap-0.5">
            <Button
                className="size-6 rounded"
                variant="ghost"
                size="icon"
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
                disabled={!canUndo}
                onClick={() => undo()}
                type="button"
            >
                <Undo2 className="size-3.5" />
            </Button>

            <Button
                className="size-6 rounded"
                variant="ghost"
                size="icon"
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
                disabled={!canRedo}
                onClick={() => redo()}
                type="button"
            >
                <Redo2 className="size-3.5" />
            </Button>
        </div>
    );
}
