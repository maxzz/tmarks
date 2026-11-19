import { AppMenuButton } from "@/components/2-main/0-all-main/app-menu-button";
import { ViewModeToggle } from "@/components/2-main/0-all-main/view-mode-toggle";
import { ButtonOptions } from "./7-btn-options";
import { ButtonThemeToggle } from "./8-btn-theme-toggle";

export function Header() {
    return (
        <header className="px-2 py-1.5 bg-background border-b border-border flex items-center justify-between">
            <AppMenuButton />

            <div className="flex items-center gap-2">
                <ViewModeToggle />
                <ButtonOptions />
                <ButtonThemeToggle />
            </div>
        </header>
    );
}
