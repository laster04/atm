import { useTranslation } from 'react-i18next';
import { Card, CardTitle, CardHeader, CardContent } from '@/components/base/card';
import TeamColorPicker from './TeamColorPicker';
import type { Standing, Team } from '@types';

interface SettingsTabProps {
	team: Team;
	standing?: Standing;
	onColorChange: (color: string | null) => void;
}

export default function SettingsTab({
	team,
	standing,
	onColorChange,
}: SettingsTabProps) {
	const { t } = useTranslation();

	return (
		<div className="space-y-4 pb-20">
			<div className="mb-4">
				<h3 className="text-lg font-medium">{t('teamManagement.pwa.teamSettings')}</h3>
				<p className="text-sm text-muted-foreground">
					{t('teamManagement.pwa.customizeBranding')}
				</p>
			</div>

			<TeamColorPicker
				teamId={team.id}
				teamName={team.name}
				initialColor={team.primaryColor}
				points={standing?.points}
				onColorChange={onColorChange}
			/>

			{/* Team Info */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						{t('teamManagement.pwa.teamInfo')}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex justify-between py-2 border-b">
						<span className="text-sm text-muted-foreground">
							{t('teamManagement.pwa.teamName')}
						</span>
						<span className="text-sm font-medium">{team.name}</span>
					</div>
					{team.season && (
						<div className="flex justify-between py-2 border-b">
							<span className="text-sm text-muted-foreground">
								{t('teamManagement.pwa.season')}
							</span>
							<span className="text-sm font-medium">{team.season.name}</span>
						</div>
					)}
					{team.manager && (
						<div className="flex justify-between py-2 border-b">
							<span className="text-sm text-muted-foreground">
								{t('teamManagement.pwa.manager')}
							</span>
							<span className="text-sm font-medium">{team.manager.name}</span>
						</div>
					)}
					<div className="flex justify-between py-2 border-b">
						<span className="text-sm text-muted-foreground">
							{t('teamManagement.pwa.seasonRecord')}
						</span>
						<span className="text-sm font-medium">
							{standing ? `${standing.wins}-${standing.losses}-${standing.draws}` : '-'}
						</span>
					</div>
					<div className="flex justify-between py-2">
						<span className="text-sm text-muted-foreground">
							{t('teamManagement.pwa.totalPoints')}
						</span>
						<span className="text-sm font-medium">{standing?.points ?? 0}</span>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
