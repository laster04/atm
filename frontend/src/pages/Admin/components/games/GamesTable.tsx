import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/base/table.tsx';
import { Badge } from '@components/base/badge.tsx';
import { Button } from '@components/base/button.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '@components/base/card.tsx';
import { Dialog, DialogContent, DialogTrigger } from '@components/base/dialog.tsx';
import { Calendar, Edit, Plus, Trash2, BarChart3 } from 'lucide-react';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';

import { Game, Season, SeasonStatus, Team } from '@types';
import { formatGameDateTime } from '@/utils/date';
import GameFormModal, { type GameFormData } from './GameFormModal.tsx';
import GenerateScheduleModal, { type GenerateScheduleData } from './GenerateScheduleModal.tsx';
import GameStatisticsModal from './GameStatisticsModal.tsx';
import { useNavigate } from "react-router-dom";

interface GamesTableProps {
	games: Game[];
	seasons: Season[];
	teams: Team[];
	selectedSeasonId: number | null;
	onSeasonChange: (seasonId: number) => void;
	onCreateGame?: (data: GameFormData) => void;
	onUpdateGame?: (id: number, data: GameFormData) => void;
	onDeleteGame?: (id: number) => void;
	onGenerateSchedule?: (data: GenerateScheduleData) => void;
}


function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
	switch (status) {
		case 'COMPLETED':
			return 'default';
		case 'IN_PROGRESS':
			return 'destructive';
		case 'SCHEDULED':
			return 'secondary';
		default:
			return 'outline';
	}
}

export default function GamesTable({
	games,
	seasons,
	teams,
	selectedSeasonId,
	onSeasonChange,
	onCreateGame,
	onUpdateGame,
	onDeleteGame,
	onGenerateSchedule,
}: GamesTableProps) {
	const navigate = useNavigate();
	const { t, i18n } = useTranslation();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
	const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
	const [editingGame, setEditingGame] = useState<Game | null>(null);
	const [statsGame, setStatsGame] = useState<Game | null>(null);

	const handleOpenCreate = () => {
		setEditingGame(null);
		setIsModalOpen(true);
	};

	const handleOpenEdit = (game: Game) => {
		setEditingGame(game);
		setIsModalOpen(true);
	};

	const handleClose = () => {
		setIsModalOpen(false);
		setEditingGame(null);
	};

	const handleSubmit = (data: GameFormData) => {
		if (editingGame) {
			onUpdateGame?.(editingGame.id, data);
		} else {
			onCreateGame?.(data);
		}
		handleClose();
	};

	const handleGenerateSubmit = (data: GenerateScheduleData) => {
		onGenerateSchedule?.(data);
		setIsGenerateModalOpen(false);
	};

	const handleCloseStats = () => {
		setIsStatsModalOpen(false);
		setStatsGame(null);
	};

	// Group games by round
	const gamesByRound = games.reduce(
		(acc, game) => {
			const round = game.round || 0;
			if (!acc[round]) acc[round] = [];
			acc[round].push(game);
			return acc;
		},
		{} as Record<number, Game[]>
	);

	const sortedRounds = Object.keys(gamesByRound)
		.map(Number)
		.sort((a, b) => a - b);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-4 flex-wrap">
					<FormControl size="small" sx={{ minWidth: 200 }}>
						<InputLabel id="game-season-filter-label">{t('admin.tabs.game.filterBySeason')}</InputLabel>
						<Select
							labelId="game-season-filter-label"
							value={selectedSeasonId || ''}
							label={t('admin.tabs.game.filterBySeason')}
							onChange={(e) => onSeasonChange(Number(e.target.value))}
						>
							{seasons.map((season) => (
								<MenuItem key={season.id} value={season.id}>
									{season.name}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					<div className="flex gap-2">
						<Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
							<DialogTrigger asChild>
								<Button
									variant="outline"
									onClick={() => setIsGenerateModalOpen(true)}
									disabled={!selectedSeasonId || teams.length < 2 || seasons.find(s => s.id === selectedSeasonId)?.status !== SeasonStatus.DRAFT}
								>
									<Calendar className="size-4 mr-2" />
									{t('admin.tabs.game.generateSchedule')}
								</Button>
							</DialogTrigger>
							<DialogContent>
								<GenerateScheduleModal
									teamsCount={teams.length}
									onSubmit={handleGenerateSubmit}
									onClose={() => setIsGenerateModalOpen(false)}
								/>
							</DialogContent>
						</Dialog>
						<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
							<DialogTrigger asChild>
								<Button onClick={handleOpenCreate} disabled={!selectedSeasonId || teams.length < 2}>
									<Plus className="size-4 mr-2" />
									{t('admin.tabs.game.addGame')}
								</Button>
							</DialogTrigger>
							<DialogContent>
								<GameFormModal
									game={editingGame}
									teams={teams}
									onSubmit={handleSubmit}
									onClose={handleClose}
								/>
							</DialogContent>
						</Dialog>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{!selectedSeasonId ? (
					<div className="text-center py-8 text-muted-foreground">{t('admin.tabs.game.selectSeasonFirst')}</div>
				) : teams.length < 2 ? (
					<div className="text-center py-8 text-muted-foreground">{t('admin.tabs.game.needMoreTeams')}</div>
				) : games.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground">{t('admin.tabs.game.noGames')}</div>
				) : (
					<div className="space-y-6">
						{sortedRounds.map((round) => (
							<div key={round}>
								{round > 0 && (
									<CardTitle className="text-lg mb-3">
										{t('admin.tabs.game.round', { round })}
									</CardTitle>
								)}
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>{t('admin.tabs.game.th-date')}</TableHead>
											<TableHead>{t('admin.tabs.game.th-homeTeam')}</TableHead>
											<TableHead className="text-center">{t('admin.tabs.game.th-score')}</TableHead>
											<TableHead>{t('admin.tabs.game.th-awayTeam')}</TableHead>
											<TableHead>{t('admin.tabs.game.th-location')}</TableHead>
											<TableHead>{t('admin.tabs.game.th-status')}</TableHead>
											<TableHead className="text-right">{t('admin.tabs.game.th-actions')}</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{gamesByRound[round].map((game) => (
											<TableRow key={game.id}>
												<TableCell className="whitespace-nowrap">
													{formatGameDateTime(game.date, i18n.language) || t('admin.tabs.game.noDate')}
												</TableCell>
												<TableCell
													className="font-medium"
													style={{ borderLeft: `4px solid ${game.homeTeam?.primaryColor ?? '#808080'}` }}
												>
													{game.homeTeam?.name}
												</TableCell>
												<TableCell className="text-center font-bold">
													{game.status === 'COMPLETED' ? (
														`${game.homeScore} - ${game.awayScore}`
													) : (
														<span className="text-muted-foreground">-</span>
													)}
												</TableCell>
												<TableCell
													className="font-medium"
													style={{ borderLeft: `4px solid ${game.awayTeam?.primaryColor ?? '#808080'}` }}
												>
													{game.awayTeam?.name}
												</TableCell>
												<TableCell>{game.location || '-'}</TableCell>
												<TableCell>
													<Badge variant={getStatusVariant(game.status)}>
														{t(`admin.tabs.game.status.${game.status}`)}
													</Badge>
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-1">
														<Button variant="ghost" size="sm"
																onClick={() => navigate(`/game-statistic/${game.id}`)}
																title={t('admin.tabs.statistics.title')}>
															<BarChart3 className="size-4" />
														</Button>
														<Button variant="ghost" size="sm" onClick={() => handleOpenEdit(game)}>
															<Edit className="size-4" />
														</Button>
														<Button variant="ghost" size="sm" onClick={() => onDeleteGame?.(game.id)}>
															<Trash2 className="size-4 text-destructive" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						))}
					</div>
				)}
			</CardContent>

			<Dialog open={isStatsModalOpen} onOpenChange={setIsStatsModalOpen}>
				<DialogContent className="max-w-3xl">
					{statsGame && (
						<GameStatisticsModal
							game={statsGame}
							onClose={handleCloseStats}
						/>
					)}
				</DialogContent>
			</Dialog>
		</Card>
	);
}
