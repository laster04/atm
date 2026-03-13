import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { Button } from '@components/base/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/base/card';
import type { Player } from '@types';

interface RosterTabProps {
	players: Player[];
	teamId: number;
	teamColor?: string | null;
}

export default function RosterTab({
	players,
	teamId,
	teamColor,
}: RosterTabProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();

	return (
		<div className="roster-container">
			<div className="roster-header">
				<div className="roster-header-content">
					<h2 className="roster-title">{t('teamManagement.pwa.teamRoster')}</h2>
					<p className="roster-subtitle">
						{players.length} {t('common.players')}
					</p>
				</div>
				<Button
					className="roster-add-button"
					onClick={() => navigate(`/team-management/${teamId}/player/new`)}
				>
					<Plus className="size-4 mr-2" />
					{t('teamManagement.pwa.add')}
				</Button>
			</div>

			<div className="roster-list">
				{players.length > 0 ? (
					players.map((player, index) => (
						<button
							key={player.id}
							className="player-card"
							onClick={() => navigate(`/team-management/${teamId}/player/${player.id}`)}
							style={{
								borderLeftColor: teamColor || '#003E7E',
								animation: `slideIn 0.3s ease-out ${index * 0.05}s backwards`
							}}
						>
							<div className="player-card-left">
								<div
									className="player-number-badge"
									style={{ backgroundColor: teamColor || '#003E7E' }}
								>
									{player.number || '?'}
								</div>
								<div className="player-card-info">
									<h3 className="player-card-name">{player.name}</h3>
									<p className="player-card-position">
										{player.position || 'Not specified'}
									</p>
								</div>
							</div>
							<ChevronRight className="player-card-icon" />
						</button>
					))
				) : (
					<div className="roster-empty-state">
						<div className="roster-empty-icon">👥</div>
						<p className="roster-empty-text">
							{t('teamDetail.noPlayers')}
						</p>
						<Button
							className="roster-empty-button"
							onClick={() => navigate(`/team-management/${teamId}/player/new`)}
						>
							<Plus className="size-4 mr-2" />
							{t('teamManagement.pwa.addPlayer')}
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
