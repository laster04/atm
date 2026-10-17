import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { Check, Copy, Hourglass, Mail, Phone, X } from 'lucide-react';
import { registrationApi } from '@/services/api';
import type { Registration, RegistrationInbox, RegistrationKind, RegistrationSettings, RegistrationStatus } from '@types';
import { formatDateShort, fromZonedInput, toZonedInput } from '@/utils/date';

const SLUG: Record<RegistrationKind, string> = { season: 'sezona', tournament: 'turnaj' };
const STATUS_TONE: Record<RegistrationStatus, { bg: string; fg: string }> = {
	PENDING: { bg: '#dbeafe', fg: '#1e3a8a' },
	WAITLISTED: { bg: '#fef3c7', fg: '#92400e' },
	APPROVED: { bg: '#dcfce7', fg: '#166534' },
	REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
	WITHDRAWN: { bg: '#f1f5f9', fg: '#475569' },
};

interface RegistrationsPanelProps {
	kind: RegistrationKind;
	id: string;
	accent: string;
	/** An approval adds a team, so the caller re-reads its teams. */
	onTeamsChanged?: () => void;
}

/**
 * The organiser's side of sign-ups, for a season or a tournament: the form's
 * settings, the link to share, and every application with its decision.
 */
export default function RegistrationsPanel({ kind, id, accent, onTeamsChanged }: RegistrationsPanelProps) {
	const { t, i18n } = useTranslation();
	const [settings, setSettings] = useState<RegistrationSettings | null>(null);
	const [draft, setDraft] = useState({ open: false, deadline: '', maxTeams: '', rules: '', fee: '' });
	const [inbox, setInbox] = useState<RegistrationInbox | null>(null);
	const [saving, setSaving] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState('');

	const link = `${window.location.origin}/prihlaska/${SLUG[kind]}/${id}`;

	const load = useCallback(async () => {
		try {
			const [settingsRes, inboxRes] = await Promise.all([registrationApi.getSettings(kind, id), registrationApi.inbox(kind, id)]);
			setSettings(settingsRes.data);
			setDraft({
				open: settingsRes.data.open,
				deadline: toZonedInput(settingsRes.data.deadline),
				maxTeams: settingsRes.data.maxTeams?.toString() ?? '',
				rules: settingsRes.data.rules ?? '',
				fee: settingsRes.data.fee ?? '',
			});
			setInbox(inboxRes.data);
		} catch {
			setError(t('registrations.loadError'));
		}
	}, [kind, id, t]);

	useEffect(() => {
		void load();
	}, [load]);

	const fail = (err: unknown, fallback: string) => {
		const axiosError = err as AxiosError<{ error: string }>;
		setError(axiosError.response?.data?.error || t(fallback));
	};

	const save = async () => {
		setError('');
		setSaving(true);
		try {
			const res = await registrationApi.updateSettings(kind, id, {
				open: draft.open,
				// The deadline is typed in Prague time and stored as an instant.
				deadline: fromZonedInput(draft.deadline),
				maxTeams: draft.maxTeams === '' ? null : Number(draft.maxTeams),
				rules: draft.rules.trim() || null,
				fee: draft.fee.trim() || null,
			});
			setSettings(res.data);
		} catch (err) {
			fail(err, 'registrations.saveError');
		} finally {
			setSaving(false);
		}
	};

	const decide = async (registration: Registration, action: 'approve' | 'waitlist' | 'reject', reason?: string) => {
		setError('');
		setBusyId(registration.id);
		try {
			if (action === 'approve') await registrationApi.approve(registration.id);
			if (action === 'waitlist') await registrationApi.waitlist(registration.id);
			if (action === 'reject') await registrationApi.reject(registration.id, reason);
			setRejecting(null);
			await load();
			if (action === 'approve') onTeamsChanged?.();
		} catch (err) {
			fail(err, 'registrations.decideError');
		} finally {
			setBusyId(null);
		}
	};

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(link);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	};

	if (!settings || !inbox) {
		return <p className="text-sm text-muted-foreground">{error || t('common.loading')}</p>;
	}

	const dirty =
		draft.open !== settings.open
		|| draft.deadline !== toZonedInput(settings.deadline)
		|| draft.maxTeams !== (settings.maxTeams?.toString() ?? '')
		|| draft.rules !== (settings.rules ?? '')
		|| draft.fee !== (settings.fee ?? '');
	const waiting = inbox.registrations.filter((r) => r.status === 'PENDING' || r.status === 'WAITLISTED');
	const decided = inbox.registrations.filter((r) => r.status !== 'PENDING' && r.status !== 'WAITLISTED');
	const field = 'h-11 w-full rounded-[10px] border border-border bg-input-background px-3 text-[14.5px]';

	const card = (registration: Registration) => {
		const tone = STATUS_TONE[registration.status];
		const open = registration.status === 'PENDING' || registration.status === 'WAITLISTED';
		const busy = busyId === registration.id;
		return (
			<div key={registration.id} className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 shadow-sm">
				<div className="flex items-start gap-2.5">
					<span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: registration.primaryColor || '#cbd5e1' }} />
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="truncate text-[15px] font-semibold">{registration.teamName}</span>
						<span className="text-[12px] text-muted-foreground">
							{registration.existingTeamId ? t('registrations.returningTeam') : t('registrations.newTeam')}
							{' · '}
							{formatDateShort(registration.createdAt, i18n.language)}
						</span>
					</div>
					<span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{ backgroundColor: tone.bg, color: tone.fg }}>
						{t(`registrations.status.${registration.status}`)}
					</span>
				</div>
				<div className="flex flex-col gap-1 text-[13px]">
					<span className="font-medium">{registration.contactName}</span>
					<a href={`mailto:${registration.email}`} className="flex items-center gap-1.5 text-primary">
						<Mail className="size-3.5" aria-hidden />{registration.email}
					</a>
					{registration.phone && (
						<a href={`tel:${registration.phone}`} className="flex items-center gap-1.5 text-primary">
							<Phone className="size-3.5" aria-hidden />{registration.phone}
						</a>
					)}
					{registration.note && <p className="whitespace-pre-wrap text-muted-foreground">{registration.note}</p>}
					{registration.roster && registration.roster.length > 0 && (
						<details>
							<summary className="cursor-pointer text-muted-foreground">{t('registrations.roster', { count: registration.roster.length })}</summary>
							<ul className="mt-1 pl-4 text-muted-foreground">
								{registration.roster.map((row, index) => (
									<li key={index}>{row.number != null ? `#${row.number} ` : ''}{row.name}</li>
								))}
							</ul>
						</details>
					)}
					{registration.reason && <p className="text-muted-foreground">{t('registrations.reason', { reason: registration.reason })}</p>}
				</div>
				{open && (
					rejecting?.id === registration.id ? (
						<div className="flex flex-col gap-2">
							<input
								value={rejecting.reason}
								onChange={(e) => setRejecting({ id: registration.id, reason: e.target.value })}
								placeholder={t('registrations.reasonPlaceholder')}
								maxLength={500}
								className={field}
							/>
							<div className="flex gap-2">
								<button type="button" disabled={busy} onClick={() => void decide(registration, 'reject', rejecting.reason.trim() || undefined)} className="h-10 flex-1 rounded-[10px] bg-red-700 text-[13.5px] font-semibold text-white disabled:opacity-60">
									{t('registrations.confirmReject')}
								</button>
								<button type="button" onClick={() => setRejecting(null)} className="h-10 flex-1 rounded-[10px] border border-border text-[13.5px] font-semibold">
									{t('common.cancel')}
								</button>
							</div>
						</div>
					) : (
						<div className="flex gap-2">
							<button type="button" disabled={busy} onClick={() => void decide(registration, 'approve')} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-[13.5px] font-semibold text-white disabled:opacity-60" style={{ backgroundColor: accent }}>
								<Check className="size-4" aria-hidden />{t('registrations.approve')}
							</button>
							{registration.status === 'PENDING' && (
								<button type="button" disabled={busy} onClick={() => void decide(registration, 'waitlist')} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-border text-[13.5px] font-semibold disabled:opacity-60">
									<Hourglass className="size-4" aria-hidden />{t('registrations.waitlist')}
								</button>
							)}
							<button type="button" disabled={busy} onClick={() => setRejecting({ id: registration.id, reason: '' })} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-border text-[13.5px] font-semibold text-red-700 disabled:opacity-60">
								<X className="size-4" aria-hidden />{t('registrations.reject')}
							</button>
						</div>
					)
				)}
			</div>
		);
	};

	return (
		<div className="flex flex-col gap-5">
			{error && <p role="alert" className="text-sm text-red-600">{error}</p>}

			<section className="flex flex-col gap-3">
				<span className="tm-section-label">{t('registrations.settings')}</span>
				<label className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-3.5">
					<input type="checkbox" checked={draft.open} onChange={(e) => setDraft({ ...draft, open: e.target.checked })} className="size-4" />
					<span className="text-[14.5px] font-medium">{t('registrations.open')}</span>
				</label>
				<div className="grid gap-3 sm:grid-cols-2">
					<label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted-foreground">
						{t('registrations.deadline')}
						<input type="datetime-local" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} className={field} />
					</label>
					<label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted-foreground">
						{t('registrations.maxTeams')}
						<input type="number" min={2} max={200} inputMode="numeric" value={draft.maxTeams} onChange={(e) => setDraft({ ...draft, maxTeams: e.target.value })} className={field} />
					</label>
				</div>
				<label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted-foreground">
					{t('registrations.fee')}
					<input value={draft.fee} onChange={(e) => setDraft({ ...draft, fee: e.target.value })} maxLength={300} placeholder={t('registrations.feePlaceholder')} className={field} />
				</label>
				<label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted-foreground">
					{t('registrations.rules')}
					<textarea value={draft.rules} onChange={(e) => setDraft({ ...draft, rules: e.target.value })} rows={4} maxLength={10000} className="rounded-[10px] border border-border bg-input-background px-3 py-2.5 text-[14.5px]" />
				</label>
				<button type="button" disabled={!dirty || saving} onClick={() => void save()} className="h-11 rounded-[10px] text-[14.5px] font-semibold text-white disabled:opacity-50" style={{ backgroundColor: accent }}>
					{t('registrations.save')}
				</button>
			</section>

			<section className="flex flex-col gap-2">
				<span className="tm-section-label">{t('registrations.link')}</span>
				<div className="flex gap-2">
					<input readOnly value={link} aria-label={t('registrations.link')} className={`${field} min-w-0 flex-1 font-mono text-[12.5px]`} />
					<button type="button" onClick={() => void copy()} className="flex h-11 shrink-0 items-center gap-1.5 rounded-[10px] border border-border px-3 text-[13.5px] font-semibold">
						<Copy className="size-4" aria-hidden />{copied ? t('registrations.copied') : t('registrations.copy')}
					</button>
				</div>
				<p className="text-[12.5px] text-muted-foreground">{settings.open ? t('registrations.linkHintOpen') : t('registrations.linkHintClosed')}</p>
			</section>

			<section className="flex flex-col gap-2.5">
				<div className="flex items-baseline justify-between gap-2">
					<span className="tm-section-label">{t('registrations.inbox')}</span>
					<span className="text-[12.5px] text-muted-foreground">
						{inbox.maxTeams != null
							? t('registrations.placesOf', { teams: inbox.teamCount, max: inbox.maxTeams })
							: t('registrations.places', { teams: inbox.teamCount })}
					</span>
				</div>
				{inbox.registrations.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t('registrations.empty')}</div>
				) : (
					<>
						{waiting.map(card)}
						{decided.length > 0 && (
							<details className="flex flex-col gap-2.5">
								<summary className="cursor-pointer text-[13px] font-semibold text-muted-foreground">{t('registrations.decided', { count: decided.length })}</summary>
								<div className="mt-2 flex flex-col gap-2.5">{decided.map(card)}</div>
							</details>
						)}
					</>
				)}
			</section>
		</div>
	);
}
