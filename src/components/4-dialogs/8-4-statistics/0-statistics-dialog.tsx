import { useAtom, useAtomValue } from "jotai";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/shadcn/dialog";
import { documentStats, statsRows } from "@/store/io/document-stats";
import { bookmarkIconsAtom, bookmarkNodesAtom, bookmarkRootIdsAtom, loadLogAtom } from "@/store/store/a-bookmarks-atoms";
import { isOpenStatisticsDialogAtom } from "./9-types-statistics";

/** Shows the statistics of the current bookmarks, in a grid, with the loads of this session below. */
export function StatisticsDialog() {
    const [isOpen, setIsOpen] = useAtom(isOpenStatisticsDialogAtom);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="p-0! max-w-lg! gap-0!" modal>
                <DialogHeader className="px-4 py-3 text-left border-b gap-0">
                    <DialogTitle className="text-sm">Statistics</DialogTitle>
                    <DialogDescription className="sr-only">Size and content of the bookmarks</DialogDescription>
                </DialogHeader>

                <StatisticsBody />
            </DialogContent>
        </Dialog>
    );
}

/** Rendered only while the dialog is open (Radix unmounts the content when it closes), so nothing is computed otherwise. */
function StatisticsBody() {
    const nodes = useAtomValue(bookmarkNodesAtom);
    const rootIds = useAtomValue(bookmarkRootIdsAtom);
    const icons = useAtomValue(bookmarkIconsAtom);
    const loads = useAtomValue(loadLogAtom);

    const rows = statsRows(documentStats({ nodes, rootIds, icons }));

    return (
        <div className="px-4 py-4 flex flex-col gap-4">
            <section className="flex flex-col gap-2">
                <h3 className="text-xs font-medium text-muted-foreground">Current bookmarks</h3>
                <div className="grid grid-cols-2 gap-2">
                    {rows.map((row) => (
                        <div key={row.label} className="px-3 py-2 bg-muted/40 border rounded-md flex flex-col gap-0.5">
                            <span className="text-xs text-muted-foreground">{row.label}</span>
                            <span className="text-base font-medium tabular-nums">{row.value}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="flex flex-col gap-2">
                <h3 className="text-xs font-medium text-muted-foreground">Loaded this session</h3>
                {loads.length === 0
                    ? <p className="text-xs text-muted-foreground">Nothing loaded yet.</p>
                    : (
                        <ul className="text-xs flex flex-col gap-1">
                            {loads.map((title, index) => <li key={index}>{title}</li>)}
                        </ul>
                    )
                }
            </section>

            <p className="text-xs text-muted-foreground">
                Sizes are characters of base64 text, about one byte each. KB = 1024 characters.
            </p>
        </div>
    );
}
