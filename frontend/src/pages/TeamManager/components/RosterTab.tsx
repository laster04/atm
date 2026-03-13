import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Edit3, Plus } from 'lucide-react';
import { Button } from '@components/base/button';
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
		<div className="roster-wrapper pb-8">
			{/* Header */}
			<div className="roster-top-bar">
				<div>
					<h2 className="roster-main-title">{t('teamManagement.pwa.teamRoster')}</h2>
					<p className="roster-count-badge">
						{players.length} {players.length === 1 ? 'Player' : t('common.players')}
					</p>
				</div>
				<Button
					className="add-player-btn"
					onClick={() => navigate(`/team-management/${teamId}/player/new`)}
				>
					<Plus className="size-4 mr-2" />
					{t('teamManagement.pwa.add')}
				</Button>
			</div>

			{/* Players List */}
			{players.length > 0 ? (
				<div className="players-table">
					{/* Table Header */}
					<div className="table-header-row">
						<div className="table-col table-col-number">#</div>
						<div className="table-col table-col-name">{t('common.name')}</div>
						<div className="table-col table-col-position">{t('teamManagement.pwa.position')}</div>
						<div className="table-col table-col-action"></div>
					</div>

					{/* Table Body */}
					<div className="table-body">
						{players.map((player, index) => (
							<button
								key={player.id}
								className="table-row"
								onClick={() => navigate(`/team-management/${teamId}/player/${player.id}`)}
								style={{ animation: `slideIn 0.3s ease-out ${index * 0.04}s backwards` }}
							>
								<div
									className="table-col table-col-number"
									style={{ backgroundColor: teamColor || '#003E7E' }}
								>
									{player.number || '-'}
								</div>
								<div className="table-col table-col-name">
									<span className="player-name-text">{player.name}</span>
								</div>
								<div className="table-col table-col-position">
									<span className="player-position-text">
										{player.position || '-'}
									</span>
								</div>
								<div className="table-col table-col-action">
									<Edit3 className="action-icon" />
								</div>
							</button>
						))}
					</div>
				</div>
			) : (
				<div className="roster-empty">
					<div className="empty-illustration">👥</div>
					<p className="empty-title">{t('teamDetail.noPlayers')}</p>
					<p className="empty-subtitle">Start building your team</p>
					<Button
						className="empty-action-btn"
						onClick={() => navigate(`/team-management/${teamId}/player/new`)}
					>
						<Plus className="size-4 mr-1" />
						{t('teamManagement.pwa.addPlayer')}
					</Button>
				</div>
			)}
		</div>
	);
}
