import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { SeasonStatus, SportType } from '@types';
import type { Season } from '@types';
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog.tsx';
import { Label } from '@components/base/label';
import { Input } from '@/components/base/input';
import { Button } from '@components/base/button';
import { formatDateForInput } from '@/utils/date';

interface SeasonFormData {
	name: string;
	sportType: SportType;
	startDate: string;
	endDate: string;
	status: SeasonStatus;
}

interface SeasonFormModalProps {
	season: Season | null;
	onSubmit: (data: SeasonFormData) => void;
	onClose: () => void;
}

export default function SeasonFormModal({ season, onSubmit, onClose }: SeasonFormModalProps) {
	const { t } = useTranslation();
	const isEditing = !!season;

	const initValues = {
		name: season?.name || '',
		sportType: season?.sportType || SportType.OTHER,
		startDate: formatDateForInput(season?.startDate),
		endDate: formatDateForInput(season?.endDate),
		status: season?.status || SeasonStatus.DRAFT,
	};

	const form = useForm<SeasonFormData>({
		defaultValues: initValues,
	});

	return (
		<>
			<DialogHeader>
				<DialogTitle>{isEditing ? t('admin.modal.editSeason') : t('admin.modal.createSeason')}</DialogTitle>
				<DialogDescription>
					{isEditing ? t('admin.modal.editSeasonDesc') : t('admin.modal.createSeasonDesc')}
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={form.handleSubmit(onSubmit)}>
				<div className="space-y-4 pt-4">
					<div className="space-y-2">
						<Label>{t('admin.modal.name')}</Label>
						<Input
							type="text"
							{...form.register('name', { required: true })}
							className="w-full px-3 py-2 border rounded"
							required
						/>
					</div>
					<div className="space-y-2">
						<FormControl className="w-full" size="small">
							<InputLabel id="select-sport-type-label">{t('admin.modal.sportType')}</InputLabel>
							<Select
								MenuProps={{
									disablePortal: true,
								}}
								labelId="select-sport-type-label"
								id="select-sport-type"
								label={t('admin.modal.sportType')}
								{...form.register('sportType')}
								defaultValue={initValues.sportType}
							>
								<MenuItem value={SportType.FOOTBALL}>{t('sports.FOOTBALL')}</MenuItem>
								<MenuItem value={SportType.BASKETBALL}>{t('sports.BASKETBALL')}</MenuItem>
								<MenuItem value={SportType.VOLLEYBALL}>{t('sports.VOLLEYBALL')}</MenuItem>
								<MenuItem value={SportType.HOCKEY}>{t('sports.HOCKEY')}</MenuItem>
								<MenuItem value={SportType.TENNIS}>{t('sports.TENNIS')}</MenuItem>
								<MenuItem value={SportType.HANDBALL}>{t('sports.HANDBALL')}</MenuItem>
								<MenuItem value={SportType.FLOORBALL}>{t('sports.FLOORBALL')}</MenuItem>
								<MenuItem value={SportType.OTHER}>{t('sports.OTHER')}</MenuItem>
							</Select>
						</FormControl>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>{t('admin.modal.startDate')}</Label>
							<Input
								type="date"
								{...form.register('startDate', { required: true })}
								className="w-full px-3 py-2 border rounded"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label>{t('admin.modal.endDate')}</Label>
							<Input
								type="date"
								{...form.register('endDate', { required: true })}
								className="w-full px-3 py-2 border rounded"
								required
							/>
						</div>
					</div>
					<div className="space-y-2">
						<FormControl className="w-full" size="small">
							<InputLabel id="select-season-status-label">{t('admin.modal.status')}</InputLabel>
							<Select
								MenuProps={{
									disablePortal: true,
								}}
								labelId="select-season-status-label"
								id="select-season-status"
								label={t('admin.modal.status')}
								{...form.register('status')}
								defaultValue={initValues.status}
							>
								<MenuItem value={SeasonStatus.DRAFT}>{t('seasons.status.DRAFT')}</MenuItem>
								<MenuItem value={SeasonStatus.ACTIVE}>{t('seasons.status.ACTIVE')}</MenuItem>
								<MenuItem value={SeasonStatus.COMPLETED}>{t('seasons.status.COMPLETED')}</MenuItem>
							</Select>
						</FormControl>
					</div>
				</div>

				<div className="flex gap-2 pt-4">
					<Button className="flex-1" type="submit">
						{isEditing ? t('common.save') : t('common.create')}
					</Button>
					<Button onClick={onClose} variant="outline">
						{t('common.cancel')}
					</Button>
				</div>
			</form>
		</>
	);
}

export type { SeasonFormData };
