import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@components/base/dialog';
import EmbedPanel from './EmbedPanel';

interface EmbedDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	kind: 'season' | 'tournament';
	id: string;
	accent: string;
	fixedTeam?: { id: string; name: string };
}

/** "Vložit na web" in a dialog, for the tournament page and a team's settings. */
export default function EmbedDialog({ open, onOpenChange, ...panel }: EmbedDialogProps) {
	const { t } = useTranslation();
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
				<DialogHeader><DialogTitle>{t('embedPanel.title')}</DialogTitle></DialogHeader>
				{open && <EmbedPanel {...panel} />}
			</DialogContent>
		</Dialog>
	);
}
