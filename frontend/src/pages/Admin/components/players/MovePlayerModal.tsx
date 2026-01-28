import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog.tsx';
import { Label } from '@components/base/label';
import { Button } from '@components/base/button';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import type { Player, Team, Season } from '@types';

interface MovePlayerModalProps {
	player: Player;
	teams: Team[];
	seasons: Season[];
	currentSeasonId: number;
	onSubmit: (playerId: number, targetTeamId: number) => void;
	onClose: () => void;
}

export default function MovePlayerModal({
	player,
	teams,
	seasons,
	currentSeasonId,
	onSubmit,
	onClose
}: MovePlayerModalProps) {
	const { t } = useTranslation();
	const [selectedSeasonId, setSelectedSeasonId] = useState<number>(currentSeasonId);
	const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');

	// Filter teams for the selected season, excluding the player's current team
	const availableTeams = teams.filter(
		(team) => team.seasonId === selectedSeasonId && team.id !== player.teamId
	);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (selectedTeamId) {
			onSubmit(player.id, selectedTeamId);
		}
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>{t('admin.modal.movePlayer')}</DialogTitle>
				<DialogDescription>
					{t('admin.modal.movePlayerDesc', { playerName: player.name })}
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={handleSubmit}>
				<div className="space-y-4 pt-4">
					<div className="space-y-2">
						<Label>{t('admin.modal.currentTeam')}</Label>
						<p className="text-sm text-muted-foreground">
							{teams.find((t) => t.id === player.teamId)?.name || '-'}
						</p>
					</div>
					<div className="space-y-2">
						<FormControl fullWidth size="small">
							<InputLabel id="move-season-label">{t('admin.modal.targetSeason')}</InputLabel>
							<Select
								labelId="move-season-label"
								value={selectedSeasonId}
								label={t('admin.modal.targetSeason')}
								onChange={(e) => {
									setSelectedSeasonId(Number(e.target.value));
									setSelectedTeamId('');
								}}
							>
								{seasons.map((season) => (
									<MenuItem key={season.id} value={season.id}>
										{season.name}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</div>
					<div className="space-y-2">
						<FormControl fullWidth size="small">
							<InputLabel id="move-team-label">{t('admin.modal.targetTeam')}</InputLabel>
							<Select
								labelId="move-team-label"
								value={selectedTeamId}
								label={t('admin.modal.targetTeam')}
								onChange={(e) => setSelectedTeamId(Number(e.target.value))}
								disabled={availableTeams.length === 0}
							>
								{availableTeams.map((team) => (
									<MenuItem key={team.id} value={team.id}>
										{team.name}
									</MenuItem>
								))}
							</Select>
						</FormControl>
						{availableTeams.length === 0 && (
							<p className="text-sm text-muted-foreground">
								{t('admin.modal.noAvailableTeams')}
							</p>
						)}
					</div>
				</div>

				<div className="flex gap-2 pt-4">
					<Button
						className="flex-1"
						type="submit"
						disabled={!selectedTeamId}
					>
						{t('admin.modal.movePlayerBtn')}
					</Button>
					<Button onClick={onClose} variant="outline" type="button">
						{t('common.cancel')}
					</Button>
				</div>
			</form>
		</>
	);
}
