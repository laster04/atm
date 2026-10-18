import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { registrationApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PublicHero } from '@/components/public';
import type { RegistrationStatus, RegistrationStatusView } from '@types';
import { formatDateShort } from '@/utils/date';

const TONE: Record<RegistrationStatus, { bg: string; fg: string }> = {
	PENDING: { bg: '#dbeafe', fg: '#1e3a8a' },
	WAITLISTED: { bg: '#fef3c7', fg: '#92400e' },
	APPROVED: { bg: '#dcfce7', fg: '#166534' },
	REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
	WITHDRAWN: { bg: '#f1f5f9', fg: '#475569' },
};

/**
 * A tournament applicant's own page, opened from the link in their receipt.
 * They have no account, so this is where they see whether the application
 * arrived, where it stands, and where they can take it back.
 */
export default function RegistrationStatusScreen() {
	const { token = '' } = useParams<{ token: string }>();
	const { t, i18n } = useTranslation();
	const [view, setView] = useState<RegistrationStatusView | null>(null);
	const [loadError, setLoadError] = useState<'notFound' | 'expired' | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	useDocumentTitle([view?.teamName, t('registration.statusPage.title')]);

	useEffect(() => {
		registrationApi.status(token)
			.then((res) => setView(res.data))
			.catch((err: AxiosError) => setLoadError(err.response?.status === 410 ? 'expired' : 'notFound'));
	}, [token]);

	const withdraw = async () => {
		setError('');
		setBusy(true);
		try {
			await registrationApi.withdrawByToken(token);
			setView((await registrationApi.status(token)).data);
			setConfirming(false);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('registration.mine.withdrawError'));
		} finally {
			setBusy(false);
		}
	};

	if (loadError) {
		return (
			<div className="mx-auto max-w-[640px] px-4 py-16 text-center text-muted-foreground">
				{t(`registration.statusPage.${loadError}`)}
			</div>
		);
	}
	if (!view) {
		return <div className="mx-auto max-w-[640px] px-4 py-16 text-center text-muted-foreground">{t('common.loading')}</div>;
	}

	const tone = TONE[view.status];
	const waiting = view.status === 'PENDING' || view.status === 'WAITLISTED';
	const competitionPath = view.competition.kind === 'season' ? `/season-detail/${view.competition.id}` : `/tournament/${view.competition.id}`;
	const details = [
		{ label: t('registration.contactName'), value: view.contactName },
		{ label: t('registration.email'), value: view.email },
		view.phone && { label: t('registration.phone'), value: view.phone },
		view.note && { label: t('registration.note'), value: view.note },
	].filter(Boolean) as { label: string; value: string }[];

	return (
		<>
			<PublicHero
				kicker={view.competition.name}
				title={view.teamName}
				subtitle={t('registration.statusPage.sentOn', { date: formatDateShort(view.createdAt, i18n.language) })}
				crumbs={[
					{ label: t('public.nav.home'), to: '/' },
					{ label: view.competition.name, to: competitionPath },
					{ label: t('registration.statusPage.title') },
				]}
			/>

			<div className="mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
				<section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
					<span className="self-start rounded-full px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-wide" style={{ backgroundColor: tone.bg, color: tone.fg }}>
						{t(`registration.status.${view.status}`)}
					</span>
					<p className="text-[15px]">
						{view.status === 'WAITLISTED' && view.waitlistPosition
							? t('registration.statusPage.text.WAITLISTED_position', { position: view.waitlistPosition })
							: t(`registration.statusPage.text.${view.status}`)}
					</p>
					{view.reason && <p className="text-[14px] text-muted-foreground">{t('registrations.reason', { reason: view.reason })}</p>}

					{error && <p role="alert" className="text-sm text-destructive-strong">{error}</p>}
					{waiting && (
						confirming ? (
							<div className="flex flex-col gap-2 rounded-lg border border-border p-3">
								<p className="text-sm">{t('registration.statusPage.withdrawConfirm')}</p>
								<div className="flex gap-2">
									<button type="button" disabled={busy} onClick={() => void withdraw()} className="h-11 flex-1 rounded-lg bg-red-700 text-[14px] font-semibold text-white disabled:opacity-60">
										{t('registration.statusPage.withdraw')}
									</button>
									<button type="button" onClick={() => setConfirming(false)} className="h-11 flex-1 rounded-lg border border-border text-[14px] font-semibold">
										{t('common.cancel')}
									</button>
								</div>
							</div>
						) : (
							<button type="button" onClick={() => setConfirming(true)} className="h-11 self-start rounded-lg border border-border px-4 text-[14px] font-semibold text-red-700">
								{t('registration.statusPage.withdraw')}
							</button>
						)
					)}
				</section>

				<section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
					<h2 className="text-[15px] font-bold">{t('registration.statusPage.sent')}</h2>
					<dl className="grid gap-2 text-[14px]">
						{details.map((row) => (
							<div key={row.label} className="grid gap-0.5 sm:grid-cols-[160px_minmax(0,1fr)]">
								<dt className="text-muted-foreground">{row.label}</dt>
								<dd className="whitespace-pre-wrap break-words">{row.value}</dd>
							</div>
						))}
					</dl>
					{view.roster && view.roster.length > 0 && (
						<div className="flex flex-col gap-1">
							<span className="text-[14px] text-muted-foreground">{t('registrations.roster', { count: view.roster.length })}</span>
							<ul className="pl-4 text-[14px]">
								{view.roster.map((row, index) => (
									<li key={index}>{row.number != null ? `#${row.number} ` : ''}{row.name}</li>
								))}
							</ul>
						</div>
					)}
					<p className="text-[13px] text-muted-foreground">{t('registration.statusPage.keepPrivate')}</p>
				</section>

				<Link to={competitionPath} className="text-sm font-semibold text-primary hover:underline">{t('registration.backToCompetition')}</Link>
			</div>
		</>
	);
}
