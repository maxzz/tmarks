import { ConfirmationDialog } from "@/components/4-dialogs/8-1-confirmation/0-confirmation-dialog";
import { LoginDialog } from "@/components/4-dialogs/8-2-login/0-login-dialog";
import { OptionsDialog } from "@/components/4-dialogs/8-3-options/0-options-dialog";
import { StatisticsDialog } from "@/components/4-dialogs/8-4-statistics/0-statistics-dialog";

export function AllDialogs() {
    return (<>
        <ConfirmationDialog />
        <LoginDialog />
        <OptionsDialog />
        <StatisticsDialog />
    </>);
}
