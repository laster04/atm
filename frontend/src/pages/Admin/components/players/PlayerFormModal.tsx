import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog.tsx';
import { Label } from '@components/base/label';
import { Input } from '@/components/base/input';
import { Button } from '@components/base/button';
import PositionSelect from '@components/PositionSelect';
import type { Player, PlayerPosition } from '@types';

interface PlayerFormData {
	name: string;
	number?: number | null;
	position?: PlayerPosition | null;
	bornYear?: number | null;
	note?: string | null;
}

interface PlayerFormModalProps {
	player?: Player | null;
	/** Positions the team's sport allows; the field is hidden when there are none. */
	positions: PlayerPosition[];
	onSubmit: (data: PlayerFormData) => void;
	onClose: () => void;
}

export default function PlayerFormModal({ player, positions, onSubmit, onClose }: PlayerFormModalProps) {
	const { t } = useTranslation();
	const isEditing = !!player;

	const initValues = {
		name: player?.name || '',
		number: player?.number || undefined,
		position: player?.position ?? null,
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
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
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
						<div className={positions.length > 0 ? 'grid grid-cols-2 gap-4' : 'space-y-2'}>
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
							{positions.length > 0 && (
								<div className="space-y-2">
									<Label htmlFor="admin-player-position">{t('admin.modal.playerPosition')}</Label>
									<PositionSelect
										id="admin-player-position"
										value={form.watch('position')}
										positions={positions}
										onChange={(position) => form.setValue('position', position || null)}
									/>
								</div>
							)}
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
			</DialogContent>
		</Dialog>
	);
}

export type { PlayerFormData };
