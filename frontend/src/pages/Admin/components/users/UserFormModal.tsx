import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { Role } from '@types';
import type { User } from '@types';
import { Select, MenuItem, FormControlLabel, FormControl, InputLabel } from "@mui/material"
import { DialogDescription, DialogHeader, DialogTitle } from "@components/base/dialog.tsx";
import { Label } from '@components/base/label';
import { Input } from "@/components/base/input";
import { Button } from "@components/base/button";
import { Checkbox } from "@components/base/checkbox.tsx";

interface UserFormData {
	name: string;
	email: string;
	password?: string;
	role: Role;
	active: boolean;
}

interface UserFormModalProps {
	user: User | null;
	onSubmit: (data: UserFormData) => void;
	onClose: () => void;
}

export default function UserFormModal({ user, onSubmit, onClose }: UserFormModalProps) {
	const { t } = useTranslation();
	const isEditing = !!user;

	const initUserValues = {
		name: user?.name || '',
		email: user?.email || '',
		password: '',
		role: user?.role || Role.VIEWER,
		active: user?.active ?? false,
	};
	const form = useForm<UserFormData>({
		defaultValues: initUserValues,
	});

	return (
		<>
			<DialogHeader>
				<DialogTitle>{isEditing ? t('admin.modal.editUser') : t('admin.modal.createUser')}</DialogTitle>
				<DialogDescription>Create a new user account with role assignment</DialogDescription>
			</DialogHeader>
			<form onSubmit={form.handleSubmit(onSubmit)}>
				<div className="space-y-4 pt-4">
					<div className="space-y-2">
						<Label>{t('admin.modal.userName')}</Label>
						<Input
							type="text"
							{...form.register('name', { required: true })}
							className="w-full px-3 py-2 border rounded"
							required/>
					</div>
					<div className="space-y-2">
						<Label className="block text-sm font-medium mb-1">{t('admin.modal.userEmail')}</Label>
						<Input
							type="email"
							{...form.register('email', { required: true })}
							className="w-full px-3 py-2 border rounded"
							required/>
					</div>
					<div className="space-y-2">
						<FormControl
							className="w-full" size="small">
							<InputLabel id="select-user-role-label">{t('admin.modal.userRole')}</InputLabel>
							<Select
								MenuProps={{
									disablePortal: true,
								}}
								labelId="select-user-role-label"
								id="select-user-role"
								label={t('admin.modal.userRole')}
								{...form.register('role')}
								defaultValue={initUserValues.role}>
								<MenuItem value={Role.VIEWER}>{t('admin.roles.VIEWER')}</MenuItem>
								<MenuItem value={Role.TEAM_MANAGER}>{t('admin.roles.TEAM_MANAGER')}</MenuItem>
								<MenuItem value={Role.SEASON_MANAGER}>{t('admin.roles.SEASON_MANAGER')}</MenuItem>
								<MenuItem value={Role.ADMIN}>{t('admin.roles.ADMIN')}</MenuItem>
							</Select>
						</FormControl>
					</div>
					<div className="space-y-2">
						<Label className="block text-sm font-medium mb-1">
							{t('admin.modal.userPassword')}
							{isEditing && (
								<span className="text-gray-500 font-normal ml-1">
                  ({t('admin.modal.leaveBlankToKeep')})
                </span>
							)}
						</Label>
						<Input
							type="password"
							{...form.register('password', { required: !isEditing, minLength: 6 })}
							className="w-full px-3 py-2 border rounded"
							placeholder="••••••••"
							required={!isEditing}
						/>
					</div>
					<div className="space-y-2">
						<FormControlLabel
							control={
								<Controller
									name="active"
									control={form.control}
									render={({ field }) => (
										<Checkbox
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									)}
								/>
							}
							label={<p className="body2">{t('admin.modal.userActive')}</p>}
						/>
					</div>

				</div>

				<div className="flex gap-2 pt-4">
					<Button className="flex-1" type="submit">
						{isEditing ? t('common.save') : t('common.create')}
					</Button>
					<Button onClick={onClose}
							variant="outline"
					>
						{t('common.cancel')}
					</Button>
				</div>
			</form>
		</>
	);
}

export type { UserFormData };
