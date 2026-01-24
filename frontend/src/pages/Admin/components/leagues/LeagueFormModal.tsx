import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { SportType } from '@types';
import type { League } from '@types';
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog.tsx';
import { Label } from '@components/base/label';
import { Input } from '@/components/base/input';
import { Button } from '@components/base/button';

interface LeagueFormData {
	name: string;
	sportType: SportType;
	logo?: string;
	description?: string;
}

interface LeagueFormModalProps {
	league: League | null;
	onSubmit: (data: LeagueFormData) => void;
	onClose: () => void;
}

export default function LeagueFormModal({ league, onSubmit, onClose }: LeagueFormModalProps) {
	const { t } = useTranslation();
	const isEditing = !!league;

	const initValues = {
		name: league?.name || '',
		sportType: league?.sportType || SportType.OTHER,
		logo: league?.logo || '',
		description: league?.description || '',
	};

	const form = useForm<LeagueFormData>({
		defaultValues: initValues,
	});

	return (
		<>
			<DialogHeader>
				<DialogTitle>{isEditing ? t('admin.modal.editLeague') : t('admin.modal.createLeague')}</DialogTitle>
				<DialogDescription>
					{isEditing ? t('admin.modal.editLeagueDesc') : t('admin.modal.createLeagueDesc')}
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={form.handleSubmit(onSubmit)}>
				<div className="space-y-4 pt-4">
					<div className="space-y-2">
						<Label>{t('admin.modal.leagueName')}</Label>
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
					<div className="space-y-2">
						<Label>{t('admin.modal.leagueLogo')}</Label>
						<Input
							type="text"
							{...form.register('logo')}
							className="w-full px-3 py-2 border rounded"
							placeholder="https://..."
						/>
					</div>
					<div className="space-y-2">
						<Label>{t('admin.modal.leagueDescription')}</Label>
						<textarea
							{...form.register('description')}
							className="w-full px-3 py-2 border rounded min-h-[80px]"
						/>
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

export type { LeagueFormData };
