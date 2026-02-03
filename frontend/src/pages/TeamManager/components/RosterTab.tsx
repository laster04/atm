import { useTranslation } from 'react-i18next';
import { ChevronRight, Plus } from 'lucide-react';
import { Button } from '@components/base/button';
import { Card, CardContent } from '@/components/base/card';
import type { Player } from '@types';

interface RosterTabProps {
	players: Player[];
	teamColor?: string | null;
	onAddPlayer: () => void;
	onEditPlayer: (player: Player) => void;
}

export default function RosterTab({
	players,
	teamColor,
	onAddPlayer,
	onEditPlayer,
}: RosterTabProps) {
	const { t } = useTranslation();

	return (
		<div className="space-y-4 pb-20">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="text-lg font-medium">{t('teamManagement.pwa.teamRoster')}</h3>
					<p className="text-sm text-muted-foreground">
						{players.length} {t('common.players')}
					</p>
				</div>
				<Button size="sm" onClick={onAddPlayer}>
					<Plus className="size-4 mr-2" />
					{t('teamManagement.pwa.add')}
				</Button>
			</div>

			<div className="space-y-3">
				{players.map((player) => (
					<Card key={player.id} className="active:bg-accent transition-colors">
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div
									className="size-12 rounded-full flex items-center justify-center text-white font-bold"
									style={{ backgroundColor: teamColor || '#003E7E' }}
								>
									{player.number || '?'}
								</div>
								<div className="flex-1 min-w-0">
									<div className="font-medium truncate">{player.name}</div>
									<div className="text-sm text-muted-foreground">
										{player.position || '-'}
									</div>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => onEditPlayer(player)}
								>
									<ChevronRight className="size-4" />
								</Button>
							</div>
						</CardContent>
					</Card>
				))}
				{players.length === 0 && (
					<div className="text-center text-muted-foreground py-8">
						{t('teamDetail.noPlayers')}
					</div>
				)}
			</div>
		</div>
	);
}
