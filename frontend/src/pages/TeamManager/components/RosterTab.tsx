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
		<Card className="mb-8">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base">{t('teamManagement.pwa.teamRoster')}</CardTitle>
						<p className="text-sm text-muted-foreground mt-1">
							{players.length} {t('common.players')}
						</p>
					</div>
					<Button size="sm" onClick={() => navigate(`/team-management/${teamId}/player/new`)}>
						<Plus className="size-4 mr-2" />
						{t('teamManagement.pwa.add')}
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{players.length > 0 ? (
					players.map((player) => (
						<button
							key={player.id}
							className="player-row-item"
							onClick={() => navigate(`/team-management/${teamId}/player/${player.id}`)}
						>
							<div
								className="player-number-badge"
								style={{ backgroundColor: teamColor || '#003E7E' }}
							>
								{player.number || '?'}
							</div>
							<div className="flex-1 min-w-0 text-left">
								<div className="player-row-name">{player.name}</div>
								<div className="player-row-position">
									{player.position || '-'}
								</div>
							</div>
							<ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
						</button>
					))
				) : (
					<div className="text-center text-muted-foreground py-4">
						{t('teamDetail.noPlayers')}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
