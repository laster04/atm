import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog.tsx';
import { Label } from '@components/base/label';
import { Input } from '@/components/base/input';
import { Button } from '@components/base/button';

interface GenerateScheduleData {
	rounds: number;
}

interface GenerateScheduleModalProps {
	teamsCount: number;
	onSubmit: (data: GenerateScheduleData) => void;
	onClose: () => void;
}

export default function GenerateScheduleModal({ teamsCount, onSubmit, onClose }: GenerateScheduleModalProps) {
	const { t } = useTranslation();

	// Calculate minimum rounds for one full round-robin
	const minRounds = teamsCount > 1 ? (teamsCount % 2 === 0 ? teamsCount - 1 : teamsCount) : 1;

	const initValues: GenerateScheduleData = {
		rounds: minRounds * 2, // Default to double round-robin
	};

	const form = useForm<GenerateScheduleData>({
		defaultValues: initValues,
	});

	const handleFormSubmit = (data: GenerateScheduleData) => {
		onSubmit({
			rounds: Number(data.rounds),
		});
	};

	const watchRounds = form.watch('rounds');
	const gamesPerRound = teamsCount > 1 ? teamsCount * 2 + (teamsCount / 2) : 0;
	const totalGames = watchRounds * gamesPerRound;

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
							{t('admin.modal.minRoundsInfo', { minRounds })}
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
