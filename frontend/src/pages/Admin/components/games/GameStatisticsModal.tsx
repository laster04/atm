import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/base/table.tsx';
import { Button } from '@components/base/button';
import { Input } from '@/components/base/input';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { Plus, Trash2, Save } from 'lucide-react';
import { Game, Player, GameStatistic } from '@types';
import { gameStatisticApi, playerApi } from '@/services/api';

interface GameStatisticsModalProps {
	game: Game;
	onClose: () => void;
}

interface StatisticFormData {
	playerId: number;
	goals: number | null;
	assists: number | null;
}

export default function GameStatisticsModal({ game, onClose }: GameStatisticsModalProps) {
	const { t } = useTranslation();
	const [statistics, setStatistics] = useState<GameStatistic[]>([]);
	const [homePlayers, setHomePlayers] = useState<Player[]>([]);
	const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [isAdding, setIsAdding] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [editForm, setEditForm] = useState<{ goals: number | null; assists: number | null }>({ goals: null, assists: null });
	const [newStat, setNewStat] = useState<StatisticFormData>({ playerId: 0, goals: null, assists: null });

	useEffect(() => {
		loadData();
	}, [game.id]);

	const loadData = async () => {
		setLoading(true);
		try {
			const [statsRes, homePlayersRes, awayPlayersRes] = await Promise.all([
				gameStatisticApi.getByGame(game.id),
				playerApi.getByTeam(game.homeTeamId),
				playerApi.getByTeam(game.awayTeamId)
			]);
			setStatistics(statsRes.data);
			setHomePlayers(homePlayersRes.data);
			setAwayPlayers(awayPlayersRes.data);
		} catch (err) {
			console.error('Failed to load data:', err);
			setError(t('admin.tabs.statistics.loadError'));
		} finally {
			setLoading(false);
		}
	};

	const allPlayers = [...homePlayers, ...awayPlayers];
	const usedPlayerIds = statistics.map(s => s.playerId);
	const availablePlayers = allPlayers.filter(p => !usedPlayerIds.includes(p.id));

	const handleAddStatistic = async () => {
		if (!newStat.playerId) return;
		setError('');
		try {
			const res = await gameStatisticApi.create(game.id, {
				playerId: newStat.playerId,
				goals: newStat.goals,
				assists: newStat.assists
			});
			setStatistics([...statistics, res.data]);
			setNewStat({ playerId: 0, goals: null, assists: null });
			setIsAdding(false);
		} catch (err) {
			console.error('Failed to create statistic:', err);
			setError(t('admin.tabs.statistics.createError'));
		}
	};

	const handleUpdateStatistic = async (id: number) => {
		setError('');
		try {
			const res = await gameStatisticApi.update(id, {
				goals: editForm.goals,
				assists: editForm.assists
			});
			setStatistics(statistics.map(s => s.id === id ? res.data : s));
			setEditingId(null);
		} catch (err) {
			console.error('Failed to update statistic:', err);
			setError(t('admin.tabs.statistics.updateError'));
		}
	};

	const handleDeleteStatistic = async (id: number) => {
		if (!confirm(t('admin.confirm.deleteStatistic'))) return;
		setError('');
		try {
			await gameStatisticApi.delete(id);
			setStatistics(statistics.filter(s => s.id !== id));
		} catch (err) {
			console.error('Failed to delete statistic:', err);
			setError(t('admin.tabs.statistics.deleteError'));
		}
	};

	const startEditing = (stat: GameStatistic) => {
		setEditingId(stat.id);
		setEditForm({ goals: stat.goals ?? null, assists: stat.assists ?? null });
	};

	const getPlayerTeamName = (playerId: number) => {
		const homePlayer = homePlayers.find(p => p.id === playerId);
		if (homePlayer) return game.homeTeam?.name;
		return game.awayTeam?.name;
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>{t('admin.tabs.statistics.title')}</DialogTitle>
				<DialogDescription>
					{game.homeTeam?.name} vs {game.awayTeam?.name}
				</DialogDescription>
			</DialogHeader>

			{error && (
				<div className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm">
					{error}
				</div>
			)}

			<div className="space-y-4 pt-4">
				{loading ? (
					<div className="text-center py-4">{t('common.loading')}</div>
				) : (
					<>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('admin.tabs.statistics.th-player')}</TableHead>
									<TableHead>{t('admin.tabs.statistics.th-team')}</TableHead>
									<TableHead className="w-24 text-center">{t('admin.tabs.statistics.th-goals')}</TableHead>
									<TableHead className="w-24 text-center">{t('admin.tabs.statistics.th-assists')}</TableHead>
									<TableHead className="w-24 text-right">{t('admin.tabs.statistics.th-actions')}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{statistics.length === 0 && !isAdding ? (
									<TableRow>
										<TableCell colSpan={5} className="text-center text-muted-foreground py-8">
											{t('admin.tabs.statistics.noStatistics')}
										</TableCell>
									</TableRow>
								) : (
									statistics.map((stat) => (
										<TableRow key={stat.id}>
											<TableCell className="font-medium">
												{stat.player?.number ? `#${stat.player.number} ` : ''}{stat.player?.name}
											</TableCell>
											<TableCell>{getPlayerTeamName(stat.playerId)}</TableCell>
											<TableCell className="text-center">
												{editingId === stat.id ? (
													<Input
														type="number"
														value={editForm.goals ?? ''}
														onChange={(e) => setEditForm({ ...editForm, goals: e.target.value ? parseInt(e.target.value) : null })}
														className="w-16 text-center mx-auto"
														min={0}
													/>
												) : (
													stat.goals ?? '-'
												)}
											</TableCell>
											<TableCell className="text-center">
												{editingId === stat.id ? (
													<Input
														type="number"
														value={editForm.assists ?? ''}
														onChange={(e) => setEditForm({ ...editForm, assists: e.target.value ? parseInt(e.target.value) : null })}
														className="w-16 text-center mx-auto"
														min={0}
													/>
												) : (
													stat.assists ?? '-'
												)}
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-1">
													{editingId === stat.id ? (
														<>
															<Button variant="ghost" size="sm" onClick={() => handleUpdateStatistic(stat.id)}>
																<Save className="size-4 text-green-600" />
															</Button>
															<Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
																{t('common.cancel')}
															</Button>
														</>
													) : (
														<>
															<Button variant="ghost" size="sm" onClick={() => startEditing(stat)}>
																{t('common.edit')}
															</Button>
															<Button variant="ghost" size="sm" onClick={() => handleDeleteStatistic(stat.id)}>
																<Trash2 className="size-4 text-destructive" />
															</Button>
														</>
													)}
												</div>
											</TableCell>
										</TableRow>
									))
								)}
								{isAdding && (
									<TableRow>
										<TableCell colSpan={2}>
											<FormControl className="w-full" size="small">
												<InputLabel id="select-player-label">{t('admin.tabs.statistics.selectPlayer')}</InputLabel>
												<Select
													MenuProps={{ disablePortal: true }}
													labelId="select-player-label"
													label={t('admin.tabs.statistics.selectPlayer')}
													value={newStat.playerId || ''}
													onChange={(e) => setNewStat({ ...newStat, playerId: Number(e.target.value) })}
												>
													{homePlayers.filter(p => !usedPlayerIds.includes(p.id)).length > 0 && (
														<MenuItem disabled className="font-semibold bg-gray-100">
															{game.homeTeam?.name}
														</MenuItem>
													)}
													{homePlayers
														.filter(p => !usedPlayerIds.includes(p.id))
														.map((player) => (
															<MenuItem key={player.id} value={player.id}>
																{player.number ? `#${player.number} ` : ''}{player.name}
															</MenuItem>
														))}
													{awayPlayers.filter(p => !usedPlayerIds.includes(p.id)).length > 0 && (
														<MenuItem disabled className="font-semibold bg-gray-100">
															{game.awayTeam?.name}
														</MenuItem>
													)}
													{awayPlayers
														.filter(p => !usedPlayerIds.includes(p.id))
														.map((player) => (
															<MenuItem key={player.id} value={player.id}>
																{player.number ? `#${player.number} ` : ''}{player.name}
															</MenuItem>
														))}
												</Select>
											</FormControl>
										</TableCell>
										<TableCell className="text-center">
											<Input
												type="number"
												value={newStat.goals ?? ''}
												onChange={(e) => setNewStat({ ...newStat, goals: e.target.value ? parseInt(e.target.value) : null })}
												className="w-16 text-center mx-auto"
												min={0}
												placeholder="0"
											/>
										</TableCell>
										<TableCell className="text-center">
											<Input
												type="number"
												value={newStat.assists ?? ''}
												onChange={(e) => setNewStat({ ...newStat, assists: e.target.value ? parseInt(e.target.value) : null })}
												className="w-16 text-center mx-auto"
												min={0}
												placeholder="0"
											/>
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-1">
												<Button variant="ghost" size="sm" onClick={handleAddStatistic} disabled={!newStat.playerId}>
													<Save className="size-4 text-green-600" />
												</Button>
												<Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
													{t('common.cancel')}
												</Button>
											</div>
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>

						{!isAdding && availablePlayers.length > 0 && (
							<Button onClick={() => setIsAdding(true)} variant="outline" className="w-full">
								<Plus className="size-4 mr-2" />
								{t('admin.tabs.statistics.addStatistic')}
							</Button>
						)}

						{!isAdding && availablePlayers.length === 0 && statistics.length > 0 && (
							<div className="text-center text-muted-foreground text-sm py-2">
								{t('admin.tabs.statistics.allPlayersHaveStats')}
							</div>
						)}
					</>
				)}
			</div>

			<div className="flex gap-2 pt-4">
				<Button onClick={onClose} variant="outline" className="flex-1">
					{t('common.cancel')}
				</Button>
			</div>
		</>
	);
}
