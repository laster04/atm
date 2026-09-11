import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog.tsx';
import { Label } from '@components/base/label';
import { Input } from '@/components/base/input';
import { Button } from '@components/base/button';
import type { Team } from '@types';

interface TeamFormData {
	name: string;
}

interface TeamFormModalProps {
	team?: Team | null;
	onSubmit: (data: TeamFormData) => void;
	onClose: () => void;
}

// A team's manager is not picked from a list of accounts: they are invited by
// email from the team's settings, which links an existing account or creates one.
export default function TeamFormModal({ team, onSubmit, onClose }: TeamFormModalProps) {
	const { t } = useTranslation();
	const isEditing = !!team;

	const initValues = {
		name: team?.name || '',
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
