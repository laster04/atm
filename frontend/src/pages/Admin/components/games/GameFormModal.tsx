import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog.tsx';
import { Label } from '@components/base/label';
import { Input } from '@/components/base/input';
import { Button } from '@components/base/button';
import { formatDateTimeForInput } from '@/utils/date';
import { Game, GameStatus, Team } from '@types';

interface GameFormData {
	date: string;
	homeTeamId: number;
	awayTeamId: number;
	homeScore?: number | null;
	awayScore?: number | null;
	period1HomeScore?: number | null;
	period1AwayScore?: number | null;
	period2HomeScore?: number | null;
	period2AwayScore?: number | null;
	period3HomeScore?: number | null;
	period3AwayScore?: number | null;
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
		period1HomeScore: game?.period1HomeScore ?? null,
		period1AwayScore: game?.period1AwayScore ?? null,
		period2HomeScore: game?.period2HomeScore ?? null,
		period2AwayScore: game?.period2AwayScore ?? null,
		period3HomeScore: game?.period3HomeScore ?? null,
		period3AwayScore: game?.period3AwayScore ?? null,
		location: game?.location || '',
		status: game?.status || GameStatus.SCHEDULED,
		round: game?.round ?? null,
	};

	const form = useForm<GameFormData>({
		defaultValues: initValues,
	});

	const watchHomeTeam = form.watch('homeTeamId');
	const watchAwayTeam = form.watch('awayTeamId');

	const toIntOrNull = (v: number | null | undefined) =>
		v !== null && v !== undefined && !isNaN(Number(v)) ? Number(v) : null;

	const handleFormSubmit = (data: GameFormData) => {
		onSubmit({
			...data,
			homeTeamId: Number(data.homeTeamId),
			awayTeamId: Number(data.awayTeamId),
			homeScore: toIntOrNull(data.homeScore),
			awayScore: toIntOrNull(data.awayScore),
			period1HomeScore: toIntOrNull(data.period1HomeScore),
			period1AwayScore: toIntOrNull(data.period1AwayScore),
			period2HomeScore: toIntOrNull(data.period2HomeScore),
			period2AwayScore: toIntOrNull(data.period2AwayScore),
			period3HomeScore: toIntOrNull(data.period3HomeScore),
			period3AwayScore: toIntOrNull(data.period3AwayScore),
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
						<div className="space-y-3">
							<div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-2">
								<div />
								<Label className="text-center text-xs text-muted-foreground">{t('admin.modal.homeScore')}</Label>
								<Label className="text-center text-xs text-muted-foreground">{t('admin.modal.awayScore')}</Label>

								<Label className="text-sm whitespace-nowrap">{t('admin.modal.totalScore', 'Total')}</Label>
								<Input
									type="number"
									{...form.register('homeScore', { valueAsNumber: true })}
									className="w-full px-3 py-2 border rounded text-center"
									min={0}
								/>
								<Input
									type="number"
									{...form.register('awayScore', { valueAsNumber: true })}
									className="w-full px-3 py-2 border rounded text-center"
									min={0}
								/>

								<Label className="text-sm whitespace-nowrap">{t('admin.modal.period1', 'Period 1')}</Label>
								<Input
									type="number"
									{...form.register('period1HomeScore', { valueAsNumber: true })}
									className="w-full px-3 py-2 border rounded text-center"
									min={0}
								/>
								<Input
									type="number"
									{...form.register('period1AwayScore', { valueAsNumber: true })}
									className="w-full px-3 py-2 border rounded text-center"
									min={0}
								/>

								<Label className="text-sm whitespace-nowrap">{t('admin.modal.period2', 'Period 2')}</Label>
								<Input
									type="number"
									{...form.register('period2HomeScore', { valueAsNumber: true })}
									className="w-full px-3 py-2 border rounded text-center"
									min={0}
								/>
								<Input
									type="number"
									{...form.register('period2AwayScore', { valueAsNumber: true })}
									className="w-full px-3 py-2 border rounded text-center"
									min={0}
								/>

								<Label className="text-sm whitespace-nowrap">{t('admin.modal.period3', 'Period 3')}</Label>
								<Input
									type="number"
									{...form.register('period3HomeScore', { valueAsNumber: true })}
									className="w-full px-3 py-2 border rounded text-center"
									min={0}
								/>
								<Input
									type="number"
									{...form.register('period3AwayScore', { valueAsNumber: true })}
									className="w-full px-3 py-2 border rounded text-center"
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
