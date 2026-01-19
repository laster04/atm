import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@components/base/table.tsx';
import { Badge } from '@components/base/badge.tsx';
import { Button } from '@components/base/button.tsx';
import { Edit, Plus, Trash2 } from 'lucide-react';

import { Card, CardContent, CardHeader } from "@components/base/card.tsx";
import type { User } from '@types';
import { Dialog, DialogContent, DialogTrigger } from "@components/base/dialog.tsx";
import UserFormModal, { type UserFormData } from "@/pages/Admin/components/users/UserFormModal.tsx";

interface UsersTableProps {
	users: User[];
	onCreateUser?: (data: UserFormData) => void;
	onUpdateUser?: (id: number, data: UserFormData) => void;
	onDeleteUser?: (id: number) => void;
}

export default function UsersTable({ users, onCreateUser, onUpdateUser, onDeleteUser }: UsersTableProps) {
	const { t } = useTranslation();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<User | null>(null);

	const handleOpenCreate = () => {
		setEditingUser(null);
		setIsModalOpen(true);
	};

	const handleOpenEdit = (user: User) => {
		setEditingUser(user);
		setIsModalOpen(true);
	};

	const handleClose = () => {
		setIsModalOpen(false);
		setEditingUser(null);
	};

	const handleSubmit = (data: UserFormData) => {
		console.log(data);
		if (editingUser) {
			onUpdateUser?.(editingUser.id, data);
		} else {
			onCreateUser?.(data);
		}
		handleClose();
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-end">
					<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
						<DialogTrigger asChild>
							<Button onClick={handleOpenCreate}>
								<Plus className="size-4 mr-2"/>
								{t('admin.tabs.user.addUser')}
							</Button>
						</DialogTrigger>
						<DialogContent>
							<UserFormModal
								user={editingUser}
								onSubmit={handleSubmit}
								onClose={handleClose}
							/>
						</DialogContent>
					</Dialog>
				</div>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t('admin.tabs.user.th-name')}</TableHead>
							<TableHead>{t('admin.tabs.user.th-email')}</TableHead>
							<TableHead>{t('admin.tabs.user.th-role')}</TableHead>
							<TableHead>{t('admin.tabs.user.th-status')}</TableHead>
							<TableHead className="text-right">{t('admin.tabs.user.th-actions')}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{users.map((user) => (
							<TableRow key={user.id}>
								<TableCell className="font-medium">{user.name}</TableCell>
								<TableCell>{user.email}</TableCell>
								<TableCell>
									<Badge variant="secondary">{user.role}</Badge>
								</TableCell>
								<TableCell>
									<Badge variant={user.active ? 'default' : 'outline'}>
										{user.active ? t('admin.tabs.user.active') : t('admin.tabs.user.inactive')}
									</Badge>
								</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-1">
										<Button variant="ghost" size="sm" onClick={() => handleOpenEdit(user)}>
											<Edit className="size-4"/>
										</Button>
										<Button variant="ghost" size="sm" onClick={() => onDeleteUser?.(user.id)}>
											<Trash2 className="size-4 text-destructive"/>
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
