import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog.tsx';
import { Label } from '@components/base/label';
import { Input } from '@/components/base/input';
import { Button } from '@components/base/button';
import type { Team, User } from '@types';

interface TeamFormData {
	name: string;
	managerId?: string;
}

interface TeamFormModalProps {
	team?: Team | null;
	teamManagers: User[];
	onSubmit: (data: TeamFormData) => void;
	onClose: () => void;
}

export default function TeamFormModal({ team, teamManagers, onSubmit, onClose }: TeamFormModalProps) {
	const { t } = useTranslation();
	const isEditing = !!team;

	const initValues = {
		name: team?.name || '',
		managerId: team?.managerId?.toString() || '',
	};

	const form = useForm<TeamFormData>({
		defaultValues: initValues,
	});

	return (
		<>
			<DialogHeader>
				<DialogTitle>{isEditing ? t('admin.modal.editTeam') : t('admin.modal.addTeam')}</DialogTitle>
				<DialogDescription>
					{isEditing ? t('admin.modal.editTeamDesc') : t('admin.modal.addTeamDesc')}
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={form.handleSubmit(onSubmit)}>
				<div className="space-y-4 pt-4">
					<div className="space-y-2">
						<Label>{t('admin.modal.teamName')}</Label>
						<Input
							type="text"
							{...form.register('name', { required: true })}
							className="w-full px-3 py-2 border rounded"
							required
						/>
					</div>
					<div className="space-y-2">
						<FormControl className="w-full" size="small">
							<InputLabel id="select-team-manager-label">{t('admin.modal.manager')}</InputLabel>
							<Select
								MenuProps={{
									disablePortal: true,
								}}
								labelId="select-team-manager-label"
								id="select-team-manager"
								label={t('admin.modal.manager')}
								{...form.register('managerId')}
								defaultValue={initValues.managerId}
							>
								<MenuItem value="">{t('admin.modal.noManager')}</MenuItem>
								{teamManagers.map((user) => (
									<MenuItem key={user.id} value={user.id.toString()}>
										{user.name} ({user.email})
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</div>
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

export type { TeamFormData };
