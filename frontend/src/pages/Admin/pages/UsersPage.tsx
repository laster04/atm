import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/services/api';
import type { User } from '@types';
import { AxiosError } from 'axios';
import UsersTable, { type UserFilters } from '../components/users/UsersTable';
import { type UserFormData } from '../components/users/UserFormModal';

const RESET_TIMEOUT_SECONDS = 10;

export default function UsersPage() {
	const { t } = useTranslation();
	const { isAdmin } = useAuth();
	const [users, setUsers] = useState<User[]>([]);
	const [error, setError] = useState('');

	useEffect(() => {
		if (isAdmin()) {
			authApi.getUsers()
				.then((res) => setUsers(res.data))
				.catch((err) => console.error(err));
		}
	}, [isAdmin]);

	if (!isAdmin()) {
		return <Navigate to="/admin/leagues" replace />;
	}

	useEffect(() => {
		if (!error) return;
		const timeout = setTimeout(() => {
			setError('');
		}, RESET_TIMEOUT_SECONDS * 1000);
		return () => clearTimeout(timeout);
	}, [error]);

	const refreshUsers = async () => {
		try {
			const res = await authApi.getUsers();
			setUsers(res.data);
		} catch (err) {
			console.error('Failed to refresh users:', err);
		}
	};

	const handleCreateUser = async (data: UserFormData) => {
		setError('');
		try {
			await authApi.createUser({
				email: data.email,
				password: data.password!,
				name: data.name,
				role: data.role,
				active: data.active
			});
			await refreshUsers();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.createUser'));
		}
	};

	const handleUpdateUser = async (id: number, data: UserFormData) => {
		setError('');
		try {
			await authApi.updateUser(id, {
				email: data.email,
				name: data.name,
				role: data.role,
				active: data.active,
				...(data.password ? { password: data.password } : {})
			});
			await refreshUsers();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.updateUser'));
		}
	};

	const handleDeleteUser = async (id: number) => {
		if (!confirm(t('admin.confirm.deleteUser'))) return;
		setError('');
		try {
			await authApi.deleteUser(id);
			await refreshUsers();
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('admin.errors.deleteUser'));
		}
	};

	const handleFilterUsers = async (filters: UserFilters) => {
		try {
			const res = await authApi.getUsers(filters);
			setUsers(res.data);
		} catch (err) {
			console.error('Failed to filter users:', err);
		}
	};

	return (
		<div className="space-y-4">
			{error && (
				<div className="bg-red-100 text-red-700 p-3 rounded">
					{error}
				</div>
			)}
			<UsersTable
				users={users}
				onCreateUser={handleCreateUser}
				onUpdateUser={handleUpdateUser}
				onDeleteUser={handleDeleteUser}
				onFilterChange={handleFilterUsers}
			/>
		</div>
	);
}
