import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { adminApi, authApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import type { AdminUserRow } from '@types';
import DataList, { type ListColumn, type ListFilter } from '../components/list/DataList';
import { useListParams } from '../components/list/useListParams';
import ConfirmDialog from '../components/list/ConfirmDialog';
import UserPanel from '../components/users/UserPanel';
import UserFormModal, { type UserFormData } from '../components/users/UserFormModal';
import { formatDay, formatInstant } from '../components/format';
import { ADMIN_GOLD, ADMIN_INK } from '../components/util';

/** Accounts, with what each one runs. Plans and subscriptions arrive with celek B. */
export default function UsersPage() {
	const { t, i18n } = useTranslation();
	const { user: me } = useAuth();
	const { openId, setOpenId } = useListParams();
	const [reload, setReload] = useState(0);
	const [creating, setCreating] = useState(false);
	const [deactivating, setDeactivating] = useState<{ ids: string[]; resolve: (done: boolean) => void } | null>(null);

	const yesNo = [
		{ value: 'true', label: t('common.yes') },
		{ value: 'false', label: t('common.no') },
	];

	const columns: ListColumn<AdminUserRow>[] = [
		{ key: 'name', label: t('adminShell.users.name'), sort: 'name', render: (row) => (
			<span className="flex flex-col">
				<span className="font-semibold">{row.name}</span>
				<span className="text-xs text-muted-foreground">{row.email}</span>
			</span>
		) },
		{ key: 'role', label: t('adminShell.users.role'), render: (row) => t(`admin.roles.${row.role}`) },
		{ key: 'status', label: t('adminShell.users.account'), render: (row) => (
			<span className="flex flex-wrap gap-1">
				<StatusPill tone={row.active ? 'ok' : 'off'}>{row.active ? t('admin.tabs.user.active') : t('admin.tabs.user.inactive')}</StatusPill>
				{!row.emailVerified && <StatusPill tone="wait">{t('admin.tabs.user.unverified')}</StatusPill>}
			</span>
		) },
		{ key: 'manages', label: t('adminShell.users.manages'), render: (row) => {
			const parts = [
				row._count.managedLeagues && t('adminShell.users.leaguesCount', { count: row._count.managedLeagues }),
				row._count.managedTournamentSeries && t('adminShell.users.seriesCount', { count: row._count.managedTournamentSeries }),
				row._count.managedTeams && t('adminShell.users.teamsCount', { count: row._count.managedTeams }),
			].filter(Boolean);
			return parts.length ? parts.join(', ') : <span className="text-muted-foreground">—</span>;
		} },
		{ key: 'createdAt', label: t('adminShell.users.registered'), sort: 'createdAt', className: 'whitespace-nowrap tabular-nums', render: (row) => formatDay(row.createdAt, i18n.language) },
		{ key: 'lastLoggedInAt', label: t('adminShell.users.lastLogin'), sort: 'lastLoggedInAt', className: 'whitespace-nowrap tabular-nums', render: (row) =>
			row.lastLoggedInAt ? formatInstant(row.lastLoggedInAt, i18n.language) : <span className="text-muted-foreground">{t('admin.tabs.user.neverLoggedIn')}</span> },
	];

	const filters: ListFilter[] = [
		{ key: 'active', label: t('adminShell.users.account'), type: 'select', options: [
			{ value: 'true', label: t('admin.tabs.user.active') },
			{ value: 'false', label: t('admin.tabs.user.inactive') },
		] },
		{ key: 'verified', label: t('adminShell.users.activation'), type: 'select', options: yesNo },
		{ key: 'role', label: t('adminShell.users.role'), type: 'select', options: [
			{ value: 'ADMIN', label: t('admin.roles.ADMIN') },
			{ value: 'USER', label: t('admin.roles.USER') },
		] },
		{ key: 'manages', label: t('adminShell.users.manages'), type: 'select', options: ['league', 'series', 'team', 'any', 'none'].map((value) => ({
			value, label: t(`adminShell.users.managesFilter.${value}`),
		})) },
		{ key: 'registered', label: t('adminShell.users.registered'), type: 'dateRange' },
	];

	const create = async (data: UserFormData) => {
		try {
			const res = await authApi.createUser({
				email: data.email, password: data.password!, name: data.name, role: data.role, active: data.active,
			});
			toast.success(t('adminShell.users.created'));
			setReload((n) => n + 1);
			setOpenId(res.data.id);
		} catch (error) {
			toast.error((error as AxiosError<{ error?: string }>).response?.data?.error ?? t('admin.errors.createUser'));
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex justify-end">
				<button
					type="button"
					onClick={() => setCreating(true)}
					className="flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-extrabold"
					style={{ backgroundColor: ADMIN_GOLD, color: ADMIN_INK }}
				>
					<Plus className="size-4" aria-hidden />
					{t('admin.tabs.user.addUser')}
				</button>
			</div>

			<div className="flex flex-wrap items-start gap-4">
				<div className="min-w-0 flex-[999_1_560px]">
					<DataList
						columns={columns}
						filters={filters}
						load={(query) => adminApi.users(query).then((res) => res.data)}
						exportCsv={adminApi.exportUsers}
						defaultSort={{ sort: 'createdAt', dir: 'desc' }}
						searchLabel={t('adminShell.users.search')}
						searchPlaceholder={t('adminShell.users.searchPlaceholder')}
						bulkActions={[{
							key: 'deactivate',
							label: t('adminShell.users.deactivate'),
							tone: 'danger',
							run: (ids) => new Promise<boolean>((resolve) => {
								const others = ids.filter((id) => id !== me?.id);
								if (others.length === 0) { toast.error(t('adminShell.users.notYourself')); resolve(false); return; }
								setDeactivating({ ids: others, resolve });
							}),
						}]}
						onOpen={(row) => setOpenId(row.id)}
						activeId={openId}
						reloadToken={reload}
						rowLabel={(row) => row.name}
						empty={t('adminShell.users.empty')}
					/>
				</div>
				{openId && <UserPanel id={openId} onClose={() => setOpenId(null)} onChanged={() => setReload((n) => n + 1)} />}
			</div>

			{creating && (
				<UserFormModal
					user={null}
					onSubmit={(data) => { setCreating(false); void create(data); }}
					onClose={() => setCreating(false)}
				/>
			)}
			{deactivating && (
				<ConfirmDialog
					title={t('adminShell.users.deactivateTitle', { count: deactivating.ids.length })}
					description={t('adminShell.users.deactivateHint', { count: deactivating.ids.length, name: '' })}
					confirmLabel={t('adminShell.users.deactivate')}
					reason="required"
					tone="danger"
					onConfirm={async (reason) => {
						try {
							const res = await adminApi.setUsersActive(deactivating.ids, false, reason);
							toast.success(t('adminShell.users.deactivated', { count: res.data.updated }));
							deactivating.resolve(true);
						} catch (error) {
							toast.error((error as AxiosError<{ error?: string }>).response?.data?.error ?? t('admin.errors.updateUser'));
							throw error;
						}
					}}
					onClose={() => {
						// Closing without confirming leaves the selection as it was.
						deactivating.resolve(false);
						setDeactivating(null);
					}}
				/>
			)}
		</div>
	);
}

function StatusPill({ tone, children }: { tone: 'ok' | 'off' | 'wait'; children: React.ReactNode }) {
	const colours = {
		ok: 'bg-[#DCFCE7] text-[#14532D]',
		off: 'bg-muted text-muted-foreground',
		wait: 'bg-[#FFF1C2] text-[#7C5A00]',
	}[tone];
	return <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${colours}`}>{children}</span>;
}
