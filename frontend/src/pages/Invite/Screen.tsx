import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Ban, Clock, Eye, EyeOff, SearchX, CheckCircle2 } from 'lucide-react';
import { AxiosError } from 'axios';
import { useAuth } from '@/context/AuthContext';
import { inviteApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { initials } from '@/pages/SeasonManager/components/util';
import type { AcceptedManagerInvite, PublicManagerInvite } from '@types';
import { APP_TIME_ZONE } from '@/utils/date';

const NAVY = '#0F172A';
const MIN_PASSWORD = 6;

/**
 * Where an invitation link lands. Someone new picks a password here and is
 * signed straight in; someone with an account signs in and accepts. Every
 * dead end (expired, cancelled, already used) says what to do next.
 */
export default function InviteScreen() {
	const { token = '' } = useParams<{ token: string }>();
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const { user, login, logout, startSession, refreshUser } = useAuth();

	const [invite, setInvite] = useState<PublicManagerInvite | null>(null);
	const [missing, setMissing] = useState(false);
	const [name, setName] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	useDocumentTitle([t('invitePage.documentTitle')]);

	useEffect(() => {
		inviteApi.getByToken(token)
			.then((res) => {
				setInvite(res.data);
				setName(res.data.name);
			})
			.catch(() => setMissing(true));
	}, [token]);

	const finish = async (result: AcceptedManagerInvite) => {
		if (result.session) startSession(result.session);
		else await refreshUser();
		navigate(result.kind === 'TEAM' && result.teamId ? `/team-management/${result.teamId}` : '/season-management', {
			replace: true,
		});
	};

	const failWith = (err: unknown) => {
		const axiosError = err as AxiosError<{ error: string; code?: string }>;
		const code = axiosError.response?.data?.code;
		if (code === 'WEAK_PASSWORD') setError(t('invitePage.errors.weakPassword', { min: MIN_PASSWORD }));
		else if (code === 'WRONG_ACCOUNT') setError(t('invitePage.errors.wrongAccount'));
		else if (code && ['EXPIRED', 'REVOKED', 'ACCEPTED', 'UNAVAILABLE'].includes(code)) {
			// Changed while the page was open; show the matching dead end.
			void inviteApi.getByToken(token).then((res) => setInvite(res.data)).catch(() => setMissing(true));
		} else setError(axiosError.response?.data?.error || t('invitePage.errors.generic'));
	};

	const acceptAsNew = async (event: FormEvent) => {
		event.preventDefault();
		setError('');
		if (password.length < MIN_PASSWORD) {
			setError(t('invitePage.errors.weakPassword', { min: MIN_PASSWORD }));
			return;
		}
		setBusy(true);
		try {
			await finish((await inviteApi.accept(token, { name, password })).data);
		} catch (err) {
			failWith(err);
		} finally {
			setBusy(false);
		}
	};

	const signInAndAccept = async (event: FormEvent) => {
		event.preventDefault();
		if (!invite) return;
		setError('');
		setBusy(true);
		try {
			if (!user) await login(invite.email, password);
			await finish((await inviteApi.accept(token, {})).data);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			// A failed sign-in answers from /auth/login, which has no code.
			if (axiosError.config?.url?.includes('/auth/login')) {
				setError(axiosError.response?.data?.error || t('invitePage.errors.generic'));
			} else failWith(err);
		} finally {
			setBusy(false);
		}
	};

	if (missing) {
		return (
			<DeadEnd icon={<SearchX className="size-7" aria-hidden />} title={t('invitePage.notFound.title')}>
				<p>{t('invitePage.notFound.body')}</p>
			</DeadEnd>
		);
	}

	if (!invite) {
		return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">{t('common.loading')}</div>;
	}

	const isTeam = invite.kind === 'TEAM';
	const targetName = invite.team?.name ?? invite.league?.name ?? '';
	const inviter = invite.invitedByName;

	if (invite.status === 'EXPIRED') {
		const ended = new Date(invite.expiresAt).toLocaleDateString(i18n.language, {
			timeZone: APP_TIME_ZONE,
			day: 'numeric',
			month: 'long',
		});
		return (
			<DeadEnd icon={<Clock className="size-7" aria-hidden />} title={t('invitePage.expired.title')}>
				<p>{t('invitePage.expired.body', { target: targetName, date: ended })}</p>
				<div className="mt-2 flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left">
					<h2 className="text-[15px] font-bold text-foreground">{t('invitePage.expired.howTitle')}</h2>
					<ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
						<li>{inviter ? t('invitePage.expired.how1', { name: inviter }) : t('invitePage.expired.how1Anonymous')}</li>
						<li>{t(isTeam ? 'invitePage.expired.how2Team' : 'invitePage.expired.how2League')}</li>
					</ol>
				</div>
			</DeadEnd>
		);
	}

	if (invite.status === 'REVOKED') {
		return (
			<DeadEnd icon={<Ban className="size-7" aria-hidden />} title={t('invitePage.revoked.title')}>
				<p>{t('invitePage.revoked.body')}</p>
			</DeadEnd>
		);
	}

	if (invite.status === 'ACCEPTED') {
		return (
			<DeadEnd icon={<CheckCircle2 className="size-7" aria-hidden />} title={t('invitePage.accepted.title')} tone="ok">
				<p>{t('invitePage.accepted.body')}</p>
				<Link to="/login" className="mt-2 flex h-11 items-center justify-center rounded-xl text-[15px] font-semibold text-white" style={{ backgroundColor: NAVY }}>
					{t('invitePage.accepted.signIn')}
				</Link>
			</DeadEnd>
		);
	}

	const signedInAsInvitee = !!user && user.email === invite.email;
	const signedInAsSomeoneElse = !!user && user.email !== invite.email;

	const intro = invite.hasAccount
		? t('invitePage.existing.intro', { target: targetName })
		: inviter
			? t(isTeam ? 'invitePage.new.introTeam' : 'invitePage.new.introLeague', { name: inviter })
			: t(isTeam ? 'invitePage.new.introTeamAnonymous' : 'invitePage.new.introLeagueAnonymous');

	const passwordField = (id: string, label: string, hint?: string, autoComplete = 'current-password') => (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-baseline justify-between">
				<label htmlFor={id} className="text-[13px] font-semibold">{label}</label>
				{invite.hasAccount && (
					<Link to="/forgot-password" className="text-[13px] font-medium text-primary">
						{t('invitePage.existing.forgot')}
					</Link>
				)}
			</div>
			<div className="relative">
				<input
					id={id}
					type={showPassword ? 'text' : 'password'}
					required
					autoComplete={autoComplete}
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					className="h-11 w-full rounded-[10px] border border-border bg-card pl-3 pr-12 text-[15px]"
				/>
				<button
					type="button"
					onClick={() => setShowPassword((v) => !v)}
					className="absolute right-0 top-0 flex size-11 items-center justify-center text-muted-foreground"
					aria-label={showPassword ? t('invitePage.hidePassword') : t('invitePage.showPassword')}
				>
					{showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
				</button>
			</div>
			{hint && <span className="text-xs leading-snug text-muted-foreground">{hint}</span>}
		</div>
	);

	const emailField = (
		<div className="flex flex-col gap-1.5">
			<label htmlFor="invite-email" className="text-[13px] font-semibold">{t('invitePage.email')}</label>
			<input
				id="invite-email"
				type="email"
				readOnly
				value={invite.email}
				className="h-11 rounded-[10px] border border-border bg-muted px-3 text-[15px] text-muted-foreground"
			/>
		</div>
	);

	const submitLabel = t(isTeam ? 'invitePage.submitTeam' : 'invitePage.submitLeague');

	let form: ReactNode;
	if (!invite.hasAccount) {
		form = (
			<form onSubmit={(e) => void acceptAsNew(e)} className="flex flex-col gap-3.5">
				{emailField}
				<div className="flex flex-col gap-1.5">
					<label htmlFor="invite-name" className="text-[13px] font-semibold">{t('invitePage.new.name')}</label>
					<input
						id="invite-name"
						type="text"
						required
						autoComplete="name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="h-11 rounded-[10px] border border-border bg-card px-3 text-[15px]"
					/>
				</div>
				{passwordField('invite-password', t('invitePage.new.password'), t('invitePage.new.passwordHint', { min: MIN_PASSWORD }), 'new-password')}
				{error && <p className="text-sm text-red-600">{error}</p>}
				<SubmitButton busy={busy} label={submitLabel} />
			</form>
		);
	} else if (signedInAsSomeoneElse) {
		form = (
			<div className="flex flex-col gap-3.5">
				<p className="text-sm leading-snug">
					{t('invitePage.wrongAccount.body', { current: user!.email, email: invite.email })}
				</p>
				<button
					type="button"
					onClick={logout}
					className="flex h-12 items-center justify-center rounded-xl text-[15px] font-semibold text-white"
					style={{ backgroundColor: NAVY }}
				>
					{t('invitePage.wrongAccount.signOut')}
				</button>
			</div>
		);
	} else {
		form = (
			<form onSubmit={(e) => void signInAndAccept(e)} className="flex flex-col gap-3.5">
				{signedInAsInvitee ? (
					<p className="text-sm leading-snug">{t('invitePage.existing.signedIn', { email: invite.email })}</p>
				) : (
					<>
						{emailField}
						{passwordField('invite-password', t('invitePage.existing.password'))}
					</>
				)}
				{error && <p className="text-sm text-red-600">{error}</p>}
				<SubmitButton busy={busy} label={signedInAsInvitee ? submitLabel : t('invitePage.existing.submit')} />
			</form>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-4 pb-10">
			<header className="flex flex-col gap-1.5 rounded-2xl px-5 pb-12 pt-5 text-white" style={{ backgroundColor: NAVY }}>
				<span className="text-xs font-semibold uppercase tracking-wider text-white/75">
					{t(isTeam ? 'invitePage.roleTeam' : 'invitePage.roleLeague')}
				</span>
				<h1 className="text-2xl font-bold leading-tight">
					{invite.hasAccount ? t('invitePage.existing.title') : t('invitePage.new.title', { name: invite.name })}
				</h1>
				<p className="text-sm leading-snug text-white/80">{intro}</p>
			</header>

			<div className="-mt-12 mx-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-md">
				<span
					className="flex size-12 shrink-0 items-center justify-center rounded-xl text-[15px] font-bold text-white"
					style={{ backgroundColor: invite.team?.primaryColor || NAVY }}
				>
					{initials(targetName)}
				</span>
				<div className="flex min-w-0 flex-col gap-0.5">
					<span className="truncate text-base font-bold">{targetName}</span>
					{(invite.leagueName || invite.seasonName) && isTeam && (
						<span className="truncate text-[13px] text-muted-foreground">
							{[invite.leagueName, invite.seasonName].filter(Boolean).join(' · ')}
						</span>
					)}
				</div>
			</div>

			<div className="mx-3 rounded-2xl border border-border bg-card p-4">{form}</div>

			<p className="px-6 text-center text-[13px] leading-snug text-muted-foreground">
				{t('invitePage.notYou', { name: invite.name })}{' '}
				<Link to="/docs/pozvani-manazera-tymu" className="font-medium text-primary">{t('invitePage.help')}</Link>
			</p>
		</div>
	);
}

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
	const { t } = useTranslation();
	return (
		<button
			type="submit"
			disabled={busy}
			className="flex h-12 items-center justify-center rounded-xl text-[15px] font-semibold text-white disabled:opacity-60"
			style={{ backgroundColor: NAVY }}
		>
			{busy ? t('common.loading') : label}
		</button>
	);
}

function DeadEnd({
	icon,
	title,
	tone = 'warn',
	children,
}: {
	icon: ReactNode;
	title: string;
	tone?: 'warn' | 'ok';
	children: ReactNode;
}) {
	const { t } = useTranslation();
	return (
		<div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
			<span
				className={`flex size-16 items-center justify-center rounded-full ${
					tone === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
				}`}
			>
				{icon}
			</span>
			<h1 className="text-[22px] font-bold leading-tight">{title}</h1>
			<div className="flex w-full flex-col gap-2 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
			<Link to="/" className="mt-2 text-sm font-semibold text-primary">
				{t('invitePage.goHome')}
			</Link>
		</div>
	);
}
