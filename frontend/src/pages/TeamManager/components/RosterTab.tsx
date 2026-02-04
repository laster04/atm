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
						<div
							key={player.id}
							className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
							onClick={() => navigate(`/team-management/${teamId}/player/${player.id}`)}
						>
							<div
								className="size-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
								style={{ backgroundColor: teamColor || '#003E7E' }}
							>
								{player.number || '?'}
							</div>
							<div className="flex-1 min-w-0">
								<div className="font-medium text-sm truncate">{player.name}</div>
								<div className="text-xs text-muted-foreground">
									{player.position || '-'}
								</div>
							</div>
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
						</div>
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
