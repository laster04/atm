import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardTitle, CardHeader, CardContent } from '@/components/base/card';
import { Button } from '@components/base/button';
import { useAuth } from '@/context/AuthContext';
import TeamColorPicker from './TeamColorPicker';
import InviteManagerModal from './InviteManagerModal';
import type { Standing, Team } from '@types';

interface SettingsTabProps {
	team: Team;
	standing?: Standing;
	onColorChange: (color: string | null) => void;
	onTeamUpdate: (team: Team) => void;
}

export default function SettingsTab({
	team,
	standing,
	onColorChange,
	onTeamUpdate,
}: SettingsTabProps) {
	const { t } = useTranslation();
	const { isAdmin, isSeasonManager } = useAuth();
	const [showInviteModal, setShowInviteModal] = useState(false);

	return (
		<div className="flex flex-col gap-4">
			<div className="settings-header">
				<h3 className="settings-title">{t('teamManagement.pwa.teamSettings')}</h3>
				<p className="settings-subtitle">
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
			<div className="flex flex-col gap-2">
				<span className="tm-section-label">{t('teamManagement.pwa.teamInfo')}</span>
				<div className="tm-rows-card">
					{[
						{ label: t('teamManagement.pwa.teamName'), value: team.name },
						...(team.season ? [{ label: t('teamManagement.pwa.season'), value: team.season.name }] : []),
						{ label: t('teamManagement.pwa.manager'), value: team.manager?.name || '—' },
						{
							label: t('teamManagement.pwa.seasonRecord'),
							value: standing ? `${standing.wins}-${standing.draws}-${standing.losses}` : '—',
						},
						{ label: t('teamManagement.pwa.totalPoints'), value: String(standing?.points ?? 0) },
					].map((row) => (
						<div key={row.label} className="flex min-h-12 items-center gap-3 px-3.5 py-2.5">
							<span className="shrink-0 text-sm text-muted-foreground">{row.label}</span>
							<span className="ml-auto min-w-0 truncate text-right text-sm font-medium">
								{row.value}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Invite Manager - Admin/Season Manager only */}
			{(isAdmin() || isSeasonManager()) && (
				<Card className="settings-card">
					<CardHeader>
						<CardTitle className="text-base">
							{t('teamDetail.inviteManager.title')}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground mb-3">
							{t('teamDetail.inviteManager.description')}
						</p>
						<Button
							onClick={() => setShowInviteModal(true)}
							className="bg-orange-500 hover:bg-orange-600"
						>
							{t('teamDetail.inviteManager.button')}
						</Button>
					</CardContent>
				</Card>
			)}

			{showInviteModal && (
				<InviteManagerModal
					teamId={team.id}
					onSuccess={(updatedTeam) => {
						onTeamUpdate(updatedTeam);
						setShowInviteModal(false);
					}}
					onClose={() => setShowInviteModal(false)}
				/>
			)}
		</div>
	);
}
