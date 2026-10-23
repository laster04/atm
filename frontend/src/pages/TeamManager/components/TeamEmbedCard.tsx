import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Code2 } from 'lucide-react';
import { Button } from '@components/base/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/base/card';
import EmbedDialog from '@/components/embed/EmbedDialog';
import { SEASON_ACCENT } from '@/pages/SeasonManager/components/util';

interface TeamEmbedCardProps {
	team: { id: string; name: string; primaryColor?: string | null };
	seasonId: string;
}

/** The club's own website: the season table with this team highlighted, or its games. */
export default function TeamEmbedCard({ team, seasonId }: TeamEmbedCardProps) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const accent = team.primaryColor && /^#[0-9a-f]{6}$/i.test(team.primaryColor) ? team.primaryColor : SEASON_ACCENT;
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Code2 className="size-5 text-primary" aria-hidden />
					<div>
						<CardTitle>{t('embedPanel.title')}</CardTitle>
						<CardDescription>{t('embedPanel.teamHint')}</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Button variant="outline" onClick={() => setOpen(true)}>{t('embedPanel.open')}</Button>
				<EmbedDialog
					open={open}
					onOpenChange={setOpen}
					kind="season"
					id={seasonId}
					accent={accent}
					fixedTeam={{ id: team.id, name: team.name }}
				/>
			</CardContent>
		</Card>
	);
}
