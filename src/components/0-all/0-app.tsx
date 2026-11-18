import { Toaster } from '@/ui/shadcn/sonner';
import { DropItDoc } from '@/ui/local-ui/6-dnd/ui-drop-it-doc';
import { doSetFilesFrom_Dnd_Atom } from '@/ui/local-ui/6-dnd/8-dnd-atoms';
import { BookmarkDialogs } from '@/bookmarks/ui/bookmark-dialogs';
import { AllDialogs } from './1-globals';
import { AppPages } from '../5-welcome';
import { Header } from '../1-header';
import { MainBody } from '../2-main';
import { Section3_Footer } from '../3-footer';

export function App() {
    return (<>
        <Toaster />
        <AllDialogs />
        <DropItDoc doSetFilesFromDropAtom={doSetFilesFrom_Dnd_Atom} />
        <BookmarkDialogs />

        <AppPages>
            <main className="h-dvh text-xs bg-background overflow-hidden grid grid-rows-[auto_minmax(0,1fr)_auto]">
                <Header />
                <MainBody />
                <Section3_Footer />
            </main>
        </AppPages>
    </>);
}
