import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog.tsx';
import { Label } from '@components/base/label';
import { Input } from '@/components/base/input';
import { Button } from '@components/base/button';

interface GenerateScheduleData {
	rounds: number;
	/** Pair teams only within their own division. */
	withinGroups: boolean;
}

interface GenerateScheduleModalProps {
	teamsCount: number;
	/** How many divisions the season has; no option is offered when it has none. */
	groupCount?: number;
	onSubmit: (data: GenerateScheduleData) => void;
	onClose: () => void;
}

export default function GenerateScheduleModal({ teamsCount, groupCount = 0, onSubmit, onClose }: GenerateScheduleModalProps) {
	const { t } = useTranslation();

	// One round is a full round-robin: every team meets every other team once.
	const gamesPerRound = teamsCount > 1 ? (teamsCount * (teamsCount - 1)) / 2 : 0;

	const initValues: GenerateScheduleData = {
		rounds: 2, // Default to double round-robin (home and away)
		// A divided season almost always means teams meet only inside their own
		// division, so that is the default wherever divisions exist.
		withinGroups: groupCount > 0,
	};

	const form = useForm<GenerateScheduleData>({
		defaultValues: initValues,
	});

	const handleFormSubmit = (data: GenerateScheduleData) => {
		onSubmit({
			rounds: Number(data.rounds),
			withinGroups: Boolean(data.withinGroups),
		});
	};

	const watchRounds = form.watch('rounds');
	const totalGames = (Number(watchRounds) || 0) * gamesPerRound;

	return (
		<>
			<DialogHeader>
				<DialogTitle>{t('admin.modal.generateSchedule')}</DialogTitle>
				<DialogDescription>{t('admin.modal.generateScheduleDesc')}</DialogDescription>
			</DialogHeader>
			<form onSubmit={form.handleSubmit(handleFormSubmit)}>
				<div className="space-y-4 pt-4">
					<div className="p-4 bg-muted rounded-lg">
						<p className="text-sm text-muted-foreground">
							{t('admin.modal.teamsInSeason', { count: teamsCount })}
						</p>
						<p className="text-sm text-muted-foreground">
							{t('admin.modal.roundInfo', { gamesPerRound })}
						</p>
					</div>

					<div className="space-y-2">
						<Label>{t('admin.modal.numberOfRounds')}</Label>
						<Input
							type="number"
							{...form.register('rounds', { required: true, valueAsNumber: true, min: 1 })}
							className="w-full px-3 py-2 border rounded"
							min={1}
							required
						/>
						<p className="text-sm text-muted-foreground">
							{t('admin.modal.totalGamesInfo', { total: totalGames })}
						</p>
					</div>

					{groupCount > 0 && (
						<div className="space-y-2">
							<label className="flex items-start gap-2.5">
								<input
									type="checkbox"
									{...form.register('withinGroups')}
									className="mt-1 size-4 shrink-0"
								/>
								<span className="flex flex-col gap-0.5">
									<span className="text-sm font-medium">{t('admin.modal.withinGroups')}</span>
									<span className="text-sm text-muted-foreground">
										{t('admin.modal.withinGroupsHint', { count: groupCount })}
									</span>
								</span>
							</label>
						</div>
					)}

					<div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
						<p className="text-sm text-amber-800">
							{t('admin.modal.generateWarning')}
						</p>
					</div>
				</div>

				<div className="flex gap-2 pt-4">
					<Button className="flex-1" type="submit">
						{t('admin.modal.generate')}
					</Button>
					<Button onClick={onClose} variant="outline" type="button">
						{t('common.cancel')}
					</Button>
				</div>
			</form>
		</>
	);
}

export type { GenerateScheduleData };
