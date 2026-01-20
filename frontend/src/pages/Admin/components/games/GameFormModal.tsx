import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog.tsx';
import { Label } from '@components/base/label';
import { Input } from '@/components/base/input';
import { Button } from '@components/base/button';
import { formatDateTimeForInput } from '@/utils/date';
import type { Game, Team, GameStatus } from '@types';

interface GameFormData {
	date: string;
	homeTeamId: number;
	awayTeamId: number;
	homeScore?: number | null;
	awayScore?: number | null;
	location?: string;
	status: GameStatus;
	round?: number | null;
}

interface GameFormModalProps {
	game?: Game | null;
	teams: Team[];
	onSubmit: (data: GameFormData) => void;
	onClose: () => void;
}

export default function GameFormModal({ game, teams, onSubmit, onClose }: GameFormModalProps) {
	const { t } = useTranslation();
	const isEditing = !!game;

	const initValues: GameFormData = {
		date: formatDateTimeForInput(game?.date) || '',
		homeTeamId: game?.homeTeamId || 0,
		awayTeamId: game?.awayTeamId || 0,
		homeScore: game?.homeScore ?? null,
		awayScore: game?.awayScore ?? null,
		location: game?.location || '',
		status: game?.status || 'SCHEDULED',
		round: game?.round ?? null,
	};

	const form = useForm<GameFormData>({
		defaultValues: initValues,
	});

	const watchHomeTeam = form.watch('homeTeamId');
	const watchAwayTeam = form.watch('awayTeamId');

	const handleFormSubmit = (data: GameFormData) => {
		onSubmit({
			...data,
			homeTeamId: Number(data.homeTeamId),
			awayTeamId: Number(data.awayTeamId),
			homeScore: data.homeScore !== null && data.homeScore !== undefined ? Number(data.homeScore) : null,
			awayScore: data.awayScore !== null && data.awayScore !== undefined ? Number(data.awayScore) : null,
			round: data.round ? Number(data.round) : null,
		});
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>{isEditing ? t('admin.modal.editGame') : t('admin.modal.addGame')}</DialogTitle>
				<DialogDescription>
					{isEditing ? t('admin.modal.editGameDesc') : t('admin.modal.addGameDesc')}
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={form.handleSubmit(handleFormSubmit)}>
				<div className="space-y-4 pt-4">
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<FormControl className="w-full" size="small">
								<InputLabel id="select-home-team-label">{t('admin.modal.homeTeam')}</InputLabel>
								<Select
									MenuProps={{ disablePortal: true }}
									labelId="select-home-team-label"
									label={t('admin.modal.homeTeam')}
									{...form.register('homeTeamId', { required: true })}
									defaultValue={initValues.homeTeamId}
								>
									{teams
										.filter((team) => team.id !== Number(watchAwayTeam))
										.map((team) => (
											<MenuItem key={team.id} value={team.id}>
												{team.name}
											</MenuItem>
										))}
								</Select>
							</FormControl>
						</div>
						<div className="space-y-2">
							<FormControl className="w-full" size="small">
								<InputLabel id="select-away-team-label">{t('admin.modal.awayTeam')}</InputLabel>
								<Select
									MenuProps={{ disablePortal: true }}
									labelId="select-away-team-label"
									label={t('admin.modal.awayTeam')}
									{...form.register('awayTeamId', { required: true })}
									defaultValue={initValues.awayTeamId}
								>
									{teams
										.filter((team) => team.id !== Number(watchHomeTeam))
										.map((team) => (
											<MenuItem key={team.id} value={team.id}>
												{team.name}
											</MenuItem>
										))}
								</Select>
							</FormControl>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>{t('admin.modal.gameDate')}</Label>
							<Input
								type="datetime-local"
								{...form.register('date', { required: true })}
								className="w-full px-3 py-2 border rounded"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label>{t('admin.modal.gameRound')}</Label>
							<Input
								type="number"
								{...form.register('round', { valueAsNumber: true })}
								className="w-full px-3 py-2 border rounded"
								min={1}
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label>{t('admin.modal.gameLocation')}</Label>
						<Input
							type="text"
							{...form.register('location')}
							className="w-full px-3 py-2 border rounded"
							placeholder={t('admin.modal.gameLocationPlaceholder')}
						/>
					</div>

					<div className="space-y-2">
						<FormControl className="w-full" size="small">
							<InputLabel id="select-game-status-label">{t('admin.modal.gameStatus')}</InputLabel>
							<Select
								MenuProps={{ disablePortal: true }}
								labelId="select-game-status-label"
								label={t('admin.modal.gameStatus')}
								{...form.register('status')}
								defaultValue={initValues.status}
							>
								<MenuItem value="SCHEDULED">{t('admin.tabs.game.status.SCHEDULED')}</MenuItem>
								<MenuItem value="IN_PROGRESS">{t('admin.tabs.game.status.IN_PROGRESS')}</MenuItem>
								<MenuItem value="COMPLETED">{t('admin.tabs.game.status.COMPLETED')}</MenuItem>
								<MenuItem value="POSTPONED">{t('admin.tabs.game.status.POSTPONED')}</MenuItem>
								<MenuItem value="CANCELLED">{t('admin.tabs.game.status.CANCELLED')}</MenuItem>
							</Select>
						</FormControl>
					</div>

					{isEditing && (
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>{t('admin.modal.homeScore')}</Label>
								<Input
									type="number"
									{...form.register('homeScore', { valueAsNumber: true })}
									className="w-full px-3 py-2 border rounded"
									min={0}
								/>
							</div>
							<div className="space-y-2">
								<Label>{t('admin.modal.awayScore')}</Label>
								<Input
									type="number"
									{...form.register('awayScore', { valueAsNumber: true })}
									className="w-full px-3 py-2 border rounded"
									min={0}
								/>
							</div>
						</div>
					)}
				</div>

				<div className="flex gap-2 pt-4">
					<Button className="flex-1" type="submit">
						{isEditing ? t('common.save') : t('common.create')}
					</Button>
					<Button onClick={onClose} variant="outline" type="button">
						{t('common.cancel')}
					</Button>
				</div>
			</form>
		</>
	);
}

export type { GameFormData };
