import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@components/base/table.tsx';
import { Badge } from '@components/base/badge.tsx';
import { Button } from '@components/base/button.tsx';
import { Input } from '@components/base/input.tsx';
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { Edit, Plus, Trash2, Search, X } from 'lucide-react';

import { Card, CardContent, CardHeader } from "@components/base/card.tsx";
import { Role } from '@types';
import type { User } from '@types';
import { Dialog, DialogContent, DialogTrigger } from "@components/base/dialog.tsx";
import UserFormModal, { type UserFormData } from "@/pages/Admin/components/users/UserFormModal.tsx";

export interface UserFilters {
	name?: string;
	role?: string;
	active?: boolean;
}

interface UsersTableProps {
	users: User[];
	onCreateUser?: (data: UserFormData) => void;
	onUpdateUser?: (id: number, data: UserFormData) => void;
	onDeleteUser?: (id: number) => void;
	onFilterChange?: (filters: UserFilters) => void;
}

export default function UsersTable({ users, onCreateUser, onUpdateUser, onDeleteUser, onFilterChange }: UsersTableProps) {
	const { t } = useTranslation();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<User | null>(null);
	const [filters, setFilters] = useState<UserFilters>({});

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

	const handleFilterChange = (key: keyof UserFilters, value: string | boolean | undefined) => {
		const newFilters = { ...filters, [key]: value };
		if (value === undefined || value === '' || value === 'all') {
			delete newFilters[key];
		}
		setFilters(newFilters);
		onFilterChange?.(newFilters);
	};

	const handleClearFilters = () => {
		setFilters({});
		onFilterChange?.({});
	};

	const hasActiveFilters = Object.keys(filters).length > 0;

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-4">
					<div className="flex items-center gap-4 flex-wrap">
						<div className="relative flex-1 min-w-[200px]">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground z-10" />
							<Input
								placeholder={t('admin.tabs.user.filterByName')}
								value={filters.name || ''}
								onChange={(e) => handleFilterChange('name', e.target.value)}
								className="pl-9"
							/>
						</div>
						<FormControl size="small" sx={{ minWidth: 180 }}>
							<InputLabel id="filter-role-label">{t('admin.tabs.user.filterByRole')}</InputLabel>
							<Select
								labelId="filter-role-label"
								value={filters.role || 'all'}
								label={t('admin.tabs.user.filterByRole')}
								onChange={(e) => handleFilterChange('role', e.target.value === 'all' ? undefined : e.target.value)}
							>
								<MenuItem value="all">{t('admin.tabs.user.allRoles')}</MenuItem>
								<MenuItem value={Role.VIEWER}>{t('admin.roles.VIEWER')}</MenuItem>
								<MenuItem value={Role.TEAM_MANAGER}>{t('admin.roles.TEAM_MANAGER')}</MenuItem>
								<MenuItem value={Role.SEASON_MANAGER}>{t('admin.roles.SEASON_MANAGER')}</MenuItem>
								<MenuItem value={Role.ADMIN}>{t('admin.roles.ADMIN')}</MenuItem>
							</Select>
						</FormControl>
						<FormControl size="small" sx={{ minWidth: 180 }}>
							<InputLabel id="filter-status-label">{t('admin.tabs.user.filterByStatus')}</InputLabel>
							<Select
								labelId="filter-status-label"
								value={filters.active === undefined ? 'all' : filters.active.toString()}
								label={t('admin.tabs.user.filterByStatus')}
								onChange={(e) => handleFilterChange('active', e.target.value === 'all' ? undefined : e.target.value === 'true')}
							>
								<MenuItem value="all">{t('admin.tabs.user.allStatuses')}</MenuItem>
								<MenuItem value="true">{t('admin.tabs.user.active')}</MenuItem>
								<MenuItem value="false">{t('admin.tabs.user.inactive')}</MenuItem>
							</Select>
						</FormControl>
						{hasActiveFilters && (
							<Button variant="ghost" size="sm" onClick={handleClearFilters}>
								<X className="size-4 mr-1" />
								{t('admin.tabs.user.clearFilters')}
							</Button>
						)}
						<div className="ml-auto">
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
					</div>
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
