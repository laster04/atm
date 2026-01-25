import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@components/base/table.tsx';
import { Button } from '@components/base/button.tsx';
import { Card, CardContent, CardHeader } from '@components/base/card.tsx';
import { Dialog, DialogContent, DialogTrigger } from '@components/base/dialog.tsx';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';

import type { Player, Team, Season } from '@types';
import PlayerFormModal, { type PlayerFormData } from './PlayerFormModal.tsx';

interface PlayersTableProps {
	players: Player[];
	teams: Team[];
	seasons: Season[];
	selectedSeasonId: number | null;
	selectedTeamId: number | null;
	onSeasonChange: (seasonId: number) => void;
	onTeamChange: (teamId: number) => void;
	onCreatePlayer?: (data: PlayerFormData) => void;
	onUpdatePlayer?: (id: number, data: PlayerFormData) => void;
	onDeletePlayer?: (id: number) => void;
}

export default function PlayersTable({
	players,
	teams,
	seasons,
	selectedSeasonId,
	selectedTeamId,
	onSeasonChange,
	onTeamChange,
	onCreatePlayer,
	onUpdatePlayer,
	onDeletePlayer,
}: PlayersTableProps) {
	const { t } = useTranslation();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

	const handleOpenCreate = () => {
		setEditingPlayer(null);
		setIsModalOpen(true);
	};

	const handleOpenEdit = (player: Player) => {
		setEditingPlayer(player);
		setIsModalOpen(true);
	};

	const handleClose = () => {
		setIsModalOpen(false);
		setEditingPlayer(null);
	};

	const handleSubmit = (data: PlayerFormData) => {
		if (editingPlayer) {
			onUpdatePlayer?.(editingPlayer.id, data);
		} else {
			onCreatePlayer?.(data);
		}
		handleClose();
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-4 flex-wrap">
					<div className="flex gap-4">
						<FormControl size="small" sx={{ minWidth: 200 }}>
							<InputLabel id="player-season-filter-label">{t('admin.tabs.player.filterBySeason')}</InputLabel>
							<Select
								labelId="player-season-filter-label"
								value={selectedSeasonId || ''}
								label={t('admin.tabs.player.filterBySeason')}
								onChange={(e) => onSeasonChange(Number(e.target.value))}
							>
								{seasons.map((season) => (
									<MenuItem key={season.id} value={season.id}>
										{season.name}
									</MenuItem>
								))}
							</Select>
						</FormControl>
						<FormControl size="small" sx={{ minWidth: 200 }} disabled={!selectedSeasonId}>
							<InputLabel id="player-team-filter-label">{t('admin.tabs.player.filterByTeam')}</InputLabel>
							<Select
								labelId="player-team-filter-label"
								value={selectedTeamId || ''}
								label={t('admin.tabs.player.filterByTeam')}
								onChange={(e) => onTeamChange(Number(e.target.value))}
							>
								{teams.map((team) => (
									<MenuItem key={team.id} value={team.id}>
										{team.name}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</div>
					<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
						<DialogTrigger asChild>
							<Button onClick={handleOpenCreate} disabled={!selectedTeamId}>
								<Plus className="size-4 mr-2" />
								{t('admin.tabs.player.addPlayer')}
							</Button>
						</DialogTrigger>
						<DialogContent>
							<PlayerFormModal
								player={editingPlayer}
								onSubmit={handleSubmit}
								onClose={handleClose}
							/>
						</DialogContent>
					</Dialog>
				</div>
			</CardHeader>
			<CardContent>
				{!selectedSeasonId ? (
					<div className="text-center py-8 text-muted-foreground">
						{t('admin.tabs.player.selectSeasonFirst')}
					</div>
				) : !selectedTeamId ? (
					<div className="text-center py-8 text-muted-foreground">
						{t('admin.tabs.player.selectTeamFirst')}
					</div>
				) : players.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground">
						{t('admin.tabs.player.noPlayers')}
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('admin.tabs.player.th-name')}</TableHead>
								<TableHead>{t('admin.tabs.player.th-number')}</TableHead>
								<TableHead>{t('admin.tabs.player.th-position')}</TableHead>
								<TableHead>{t('admin.tabs.player.th-bornYear')}</TableHead>
								<TableHead>{t('admin.tabs.player.th-note')}</TableHead>
								<TableHead className="text-right">{t('admin.tabs.player.th-actions')}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{players.map((player) => (
								<TableRow key={player.id}>
									<TableCell className="font-medium">{player.name}</TableCell>
									<TableCell>{player.number || '-'}</TableCell>
									<TableCell>{player.position || '-'}</TableCell>
									<TableCell>{player.bornYear || '-'}</TableCell>
									<TableCell>{player.note || '-'}</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-1">
											<Button variant="ghost" size="sm" onClick={() => handleOpenEdit(player)}>
												<Edit className="size-4" />
											</Button>
											<Button variant="ghost" size="sm" onClick={() => onDeletePlayer?.(player.id)}>
												<Trash2 className="size-4 text-destructive" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
