import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog.tsx';
import { Label } from '@components/base/label';
import { Input } from '@/components/base/input';
import { Button } from '@components/base/button';
import type { Player } from '@types';

interface PlayerFormData {
	name: string;
	number?: number | null;
	position?: string | null;
	bornYear?: number | null;
	note?: string | null;
}

interface PlayerFormModalProps {
	player?: Player | null;
	onSubmit: (data: PlayerFormData) => void;
	onClose: () => void;
}

export default function PlayerFormModal({ player, onSubmit, onClose }: PlayerFormModalProps) {
	const { t } = useTranslation();
	const isEditing = !!player;

	const initValues = {
		name: player?.name || '',
		number: player?.number || undefined,
		position: player?.position || '',
		bornYear: player?.bornYear || undefined,
		note: player?.note || '',
	};

	const form = useForm<PlayerFormData>({
		defaultValues: initValues,
	});

	const handleFormSubmit = (data: PlayerFormData) => {
		onSubmit({
			name: data.name,
			number: data.number ? Number(data.number) : null,
			position: data.position || null,
			bornYear: data.bornYear ? Number(data.bornYear) : null,
			note: data.note || null,
		});
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>{isEditing ? t('admin.modal.editPlayer') : t('admin.modal.addPlayer')}</DialogTitle>
				<DialogDescription>
					{isEditing ? t('admin.modal.editPlayerDesc') : t('admin.modal.addPlayerDesc')}
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={form.handleSubmit(handleFormSubmit)}>
				<div className="space-y-4 pt-4">
					<div className="space-y-2">
						<Label>{t('admin.modal.playerName')}</Label>
						<Input
							type="text"
							{...form.register('name', { required: true })}
							className="w-full px-3 py-2 border rounded"
							required
						/>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>{t('admin.modal.playerNumber')}</Label>
							<Input
								type="number"
								{...form.register('number', { valueAsNumber: true })}
								className="w-full px-3 py-2 border rounded"
								min={0}
								max={99}
							/>
						</div>
						<div className="space-y-2">
							<Label>{t('admin.modal.playerPosition')}</Label>
							<Input
								type="text"
								{...form.register('position')}
								className="w-full px-3 py-2 border rounded"
							/>
						</div>
					</div>
					<div className="space-y-2">
						<Label>{t('admin.modal.playerBornYear')}</Label>
						<Input
							type="number"
							{...form.register('bornYear', { valueAsNumber: true })}
							className="w-full px-3 py-2 border rounded"
							min={1900}
							max={new Date().getFullYear()}
						/>
					</div>
					<div className="space-y-2">
						<Label>{t('admin.modal.playerNote')}</Label>
						<Input
							type="text"
							{...form.register('note')}
							className="w-full px-3 py-2 border rounded"
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

export type { PlayerFormData };
