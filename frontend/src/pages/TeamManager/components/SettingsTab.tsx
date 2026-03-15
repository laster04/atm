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
	const { isAdmin } = useAuth();
	const [showInviteModal, setShowInviteModal] = useState(false);

	return (
		<div className="space-y-4 pb-20">
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
			<Card className="settings-card">
				<CardHeader>
					<CardTitle className="text-base">
						{t('teamManagement.pwa.teamInfo')}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="settings-row">
						<span className="settings-row-label">
							{t('teamManagement.pwa.teamName')}
						</span>
						<span className="settings-row-value">{team.name}</span>
					</div>
					{team.season && (
						<div className="settings-row">
							<span className="settings-row-label">
								{t('teamManagement.pwa.season')}
							</span>
							<span className="settings-row-value">{team.season.name}</span>
						</div>
					)}
					<div className="settings-row">
						<span className="settings-row-label">
							{t('teamManagement.pwa.manager')}
						</span>
						<span className="settings-row-value">
							{team.manager?.name || '-'}
						</span>
					</div>
					<div className="settings-row">
						<span className="settings-row-label">
							{t('teamManagement.pwa.seasonRecord')}
						</span>
						<span className="settings-row-value">
							{standing ? `${standing.wins}-${standing.losses}-${standing.draws}` : '-'}
						</span>
					</div>
					<div className="settings-row settings-row-last">
						<span className="settings-row-label">
							{t('teamManagement.pwa.totalPoints')}
						</span>
						<span className="settings-row-value">{standing?.points ?? 0}</span>
					</div>
				</CardContent>
			</Card>

			{/* Invite Manager - Admin only */}
			{isAdmin() && (
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
