import { TopMenu } from "@/components/1-header/1-top-menu";
import { ViewModeToggle } from "@/components/1-header/6-view-mode-toggle";
import { ButtonOptions } from "./7-btn-options";
import { ButtonThemeToggle } from "./8-btn-theme-toggle";
import { UndoRedoButtons } from "./2-undo-redo-buttons";

export function Header() {
    return (
        <header className="px-2 py-1.5 bg-background border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-1">
                <TopMenu />
                <UndoRedoButtons />
            </div>

            <div className="flex items-center gap-2">
                <ViewModeToggle />
                <ButtonOptions />
                <ButtonThemeToggle />
            </div>
        </header>
    );
}
