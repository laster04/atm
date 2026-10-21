import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { adminApi, authApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import type { AdminUserDetail } from '@types';
import DetailPanel, { PanelFacts, PanelPending } from '../list/DetailPanel';
import ConfirmDialog from '../list/ConfirmDialog';
import { AuditTrail } from '../audit/AuditChanges';
import UserFormModal, { type UserFormData } from './UserFormModal';
import { formatDay, formatInstant } from '../format';
import { ADMIN_GOLD, ADMIN_INK } from '../util';

interface UserPanelProps {
	id: string;
	onClose: () => void;
	/** The list reloads its page after any change here. */
	onChanged: () => void;
}

type Pending = 'deactivate' | 'activate' | 'delete' | null;

const errorText = (error: unknown, fallback: string) =>
	(error as AxiosError<{ error?: string }>).response?.data?.error ?? fallback;

/**
 * One account: who it is, what it pays for (celek B), what it runs and what
 * was done to it. Every change here is written to the audit log by the server.
 */
export default function UserPanel({ id, onClose, onChanged }: UserPanelProps) {
	const { t, i18n } = useTranslation();
	const { user: me } = useAuth();
	const [user, setUser] = useState<AdminUserDetail | null>(null);
	const [failed, setFailed] = useState(false);
	const [editing, setEditing] = useState(false);
	const [pending, setPending] = useState<Pending>(null);
	const [sending, setSending] = useState(false);
	const [reload, setReload] = useState(0);

	useEffect(() => {
		setFailed(false);
		adminApi.user(id)
			.then((res) => setUser(res.data))
			.catch((error) => {
				console.error(error);
				setFailed(true);
			});
	}, [id, reload]);

	const changed = () => {
		setReload((n) => n + 1);
		onChanged();
	};

	if (!user || user.id !== id) {
		return (
			<DetailPanel
				kicker={t('adminShell.users.kicker')}
				title={failed ? t('adminShell.list.loadError') : <Loader2 className="size-5 animate-spin" aria-label={t('common.loading')} />}
				tabs={[]}
				onClose={onClose}
			/>
		);
	}

	const isMe = me?.id === user.id;

	const save = async (data: UserFormData) => {
		try {
			await authApi.updateUser(user.id, {
				email: data.email,
				name: data.name,
				role: data.role,
				active: data.active,
				...(data.password ? { password: data.password } : {}),
			});
			toast.success(t('adminShell.users.saved'));
			changed();
		} catch (error) {
			toast.error(errorText(error, t('admin.errors.updateUser')));
		}
	};

	const resend = async () => {
		setSending(true);
		try {
			await authApi.resendActivationEmail(user.email);
			toast.success(t('admin.tabs.user.verificationSent'));
		} catch {
			toast.error(t('admin.tabs.user.verificationFailed'));
		} finally {
			setSending(false);
		}
	};

	const setActive = async (active: boolean, reason: string) => {
		try {
			await adminApi.setUsersActive([user.id], active, reason);
			toast.success(t(active ? 'adminShell.users.activated' : 'adminShell.users.deactivated', { count: 1 }));
			changed();
		} catch (error) {
			toast.error(errorText(error, t('admin.errors.updateUser')));
			throw error;
		}
	};

	const remove = async () => {
		try {
			await authApi.deleteUser(user.id);
			toast.success(t('adminShell.users.deleted'));
			onChanged();
			onClose();
		} catch (error) {
			toast.error(errorText(error, t('admin.errors.deleteUser')));
			throw error;
		}
	};

	const managesNothing = user.managedLeagues.length + user.managedTournamentSeries.length + user.managedTeams.length === 0;

	const overview = (
		<>
			<PanelFacts rows={[
				{ label: t('adminShell.users.email'), value: user.email },
				{ label: t('adminShell.users.role'), value: t(`admin.roles.${user.role}`) },
				{ label: t('adminShell.users.account'), value: user.active ? t('admin.tabs.user.active') : t('admin.tabs.user.inactive') },
				{ label: t('adminShell.users.activation'), value: user.emailVerified
					? t('adminShell.users.verifiedOn', { date: formatDay(user.emailVerifiedAt, i18n.language) })
					: t('admin.tabs.user.unverified') },
				{ label: t('adminShell.users.registered'), value: formatInstant(user.createdAt, i18n.language) },
				{ label: t('adminShell.users.lastLogin'), value: user.lastLoggedInAt ? formatInstant(user.lastLoggedInAt, i18n.language) : t('admin.tabs.user.neverLoggedIn') },
				{ label: t('adminShell.users.digest'), value: user.emailDigest ? t('common.yes') : t('common.no') },
				{ label: t('adminShell.users.activity'), value: t('adminShell.users.activityValue', {
					players: user._count.playerProfiles, tickets: user._count.supportTickets, registrations: user._count.registrations,
				}) },
			]} />
		</>
	);

	const manages = managesNothing ? (
		<p className="text-[13px] text-muted-foreground">{t('adminShell.users.managesNothing')}</p>
	) : (
		<div className="flex flex-col gap-4 text-[13.5px]">
			{user.managedLeagues.length > 0 && (
				<section className="flex flex-col gap-1.5">
					<h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('adminShell.users.leagues')}</h3>
					{user.managedLeagues.map((league) => (
						<div key={league.id} className="flex flex-col gap-1 rounded-lg border border-border p-2.5">
							<Link to={`/leagues/${league.id}`} className="font-semibold">{league.name}</Link>
							{league.seasons.map((season) => (
								<Link key={season.id} to={`/season-management/${season.id}`} className="flex justify-between gap-2 text-[13px]">
									<span>{season.name}</span>
									<span className="text-muted-foreground">{t(`seasonManagement.status.${season.status}`)}</span>
								</Link>
							))}
						</div>
					))}
				</section>
			)}
			{user.managedTournamentSeries.length > 0 && (
				<section className="flex flex-col gap-1.5">
					<h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('adminShell.users.series')}</h3>
					{user.managedTournamentSeries.map((series) => (
						<div key={series.id} className="flex flex-col gap-1 rounded-lg border border-border p-2.5">
							<Link to={`/tournament-management/series/${series.id}`} className="font-semibold">{series.name}</Link>
							{series.tournaments.map((tournament) => (
								<Link key={tournament.id} to={`/tournament-management/tournament/${tournament.id}`} className="flex justify-between gap-2 text-[13px]">
									<span>{tournament.name}</span>
									<span className="text-muted-foreground">{t(`tm.tournamentStatus.${tournament.status}`)}</span>
								</Link>
							))}
						</div>
					))}
				</section>
			)}
			{user.managedTeams.length > 0 && (
				<section className="flex flex-col gap-1.5">
					<h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('adminShell.users.teams')}</h3>
					{user.managedTeams.map((team) => (
						<Link key={team.id} to={`/team-management/${team.id}`} className="flex items-center gap-2">
							<span className="size-3 rounded-sm" style={{ backgroundColor: team.primaryColor ?? '#003E7E' }} aria-hidden />
							{team.name}
						</Link>
					))}
				</section>
			)}
		</div>
	);

	return (
		<>
			<DetailPanel
				key={user.id}
				kicker={t('adminShell.users.kicker')}
				title={user.name}
				onClose={onClose}
				tabs={[
					{ key: 'overview', label: t('adminShell.panel.overview'), content: overview },
					{ key: 'plans', label: t('adminShell.users.tabs.plans'), content: <PanelPending>{t('adminShell.users.plansPending')}</PanelPending> },
					{ key: 'payments', label: t('adminShell.users.tabs.payments'), content: <PanelPending>{t('adminShell.users.paymentsPending')}</PanelPending> },
					{ key: 'billing', label: t('adminShell.users.tabs.billing'), content: <PanelPending>{t('adminShell.users.billingPending')}</PanelPending> },
					{ key: 'manages', label: t('adminShell.users.tabs.manages'), content: manages },
					{ key: 'history', label: t('adminShell.panel.history'), content: <AuditTrail entityType="User" entityId={user.id} /> },
				]}
				footer={
					<>
						<button type="button" onClick={() => setEditing(true)} className="h-11 flex-1 rounded-lg px-4 text-sm font-extrabold" style={{ backgroundColor: ADMIN_GOLD, color: ADMIN_INK }}>
							{t('common.edit')}
						</button>
						{!user.emailVerified && (
							<button type="button" onClick={resend} disabled={sending} className="h-11 rounded-lg border border-border px-4 text-sm font-bold disabled:opacity-60">
								{t('admin.tabs.user.resendVerification')}
							</button>
						)}
						{!isMe && (
							<button type="button" onClick={() => setPending(user.active ? 'deactivate' : 'activate')} className="h-11 rounded-lg border border-border px-4 text-sm font-bold">
								{user.active ? t('adminShell.users.deactivate') : t('adminShell.users.activate')}
							</button>
						)}
						{!isMe && (
							<button type="button" onClick={() => setPending('delete')} className="h-11 rounded-lg px-3 text-sm font-bold text-destructive">
								{t('common.delete')}
							</button>
						)}
					</>
				}
			/>

			{editing && (
				<UserFormModal
					user={user}
					onSubmit={(data) => { setEditing(false); void save(data); }}
					onClose={() => setEditing(false)}
				/>
			)}
			{pending === 'deactivate' && (
				<ConfirmDialog
					title={t('adminShell.users.deactivateTitle', { count: 1 })}
					description={t('adminShell.users.deactivateHint', { count: 1, name: user.name })}
					confirmLabel={t('adminShell.users.deactivate')}
					reason="required"
					tone="danger"
					onConfirm={(reason) => setActive(false, reason)}
					onClose={() => setPending(null)}
				/>
			)}
			{pending === 'activate' && (
				<ConfirmDialog
					title={t('adminShell.users.activateTitle')}
					description={t('adminShell.users.activateHint', { name: user.name })}
					confirmLabel={t('adminShell.users.activate')}
					reason="optional"
					onConfirm={(reason) => setActive(true, reason)}
					onClose={() => setPending(null)}
				/>
			)}
			{pending === 'delete' && (
				<ConfirmDialog
					title={t('adminShell.users.deleteTitle')}
					description={t('adminShell.users.deleteHint', { name: user.name })}
					confirmLabel={t('common.delete')}
					tone="danger"
					onConfirm={remove}
					onClose={() => setPending(null)}
				/>
			)}
		</>
	);
}
