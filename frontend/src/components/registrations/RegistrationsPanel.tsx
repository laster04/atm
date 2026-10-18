import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { AlertTriangle, ArrowUp, Check, CheckCircle2, Eye, Hourglass, Mail, Phone, X } from 'lucide-react';
import { registrationApi } from '@/services/api';
import type { Registration, RegistrationInbox, RegistrationKind, RegistrationLifecycle, RegistrationSettings, RegistrationStatus } from '@types';
import { formatDateShort, formatDeadline, fromZonedInput, toZonedInput } from '@/utils/date';
import SharePanel, { REGISTRATION_SLUG, registrationLink } from './SharePanel';

const STATUS_TONE: Record<RegistrationStatus, { bg: string; fg: string }> = {
	PENDING: { bg: '#dbeafe', fg: '#1e3a8a' },
	WAITLISTED: { bg: '#fef3c7', fg: '#92400e' },
	APPROVED: { bg: '#dcfce7', fg: '#166534' },
	REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
	WITHDRAWN: { bg: '#f1f5f9', fg: '#475569' },
};
const LIFECYCLE_TONE: Record<RegistrationLifecycle, { bg: string; fg: string }> = {
	DRAFT: { bg: '#f1f5f9', fg: '#475569' },
	OPEN: { bg: '#dcfce7', fg: '#166534' },
	FULL: { bg: '#fef3c7', fg: '#92400e' },
	PAST_DEADLINE: { bg: '#fee2e2', fg: '#991b1b' },
	CLOSED: { bg: '#f1f5f9', fg: '#475569' },
};

interface RegistrationsPanelProps {
	kind: RegistrationKind;
	id: string;
	accent: string;
	/** An approval adds a team, so the caller re-reads its teams. */
	onTeamsChanged?: () => void;
	/** The form was published or closed, for callers that show its state elsewhere. */
	onLifecycleChanged?: (lifecycle: RegistrationLifecycle) => void;
}

type Draft = { deadline: string; maxTeams: string; rules: string; fee: string };

const draftOf = (settings: RegistrationSettings): Draft => ({
	deadline: toZonedInput(settings.deadline),
	maxTeams: settings.maxTeams?.toString() ?? '',
	rules: settings.rules ?? '',
	fee: settings.fee ?? '',
});

/**
 * The organiser's side of sign-ups, for a season or a tournament. The form
 * has a life of its own: its terms are prepared and previewed, then it is
 * published deliberately, shared, and closed again. Below that, every
 * application with its decision, and where the places stand.
 */
export default function RegistrationsPanel({ kind, id, accent, onTeamsChanged, onLifecycleChanged }: RegistrationsPanelProps) {
	const { t, i18n } = useTranslation();
	const [settings, setSettings] = useState<RegistrationSettings | null>(null);
	const [draft, setDraft] = useState<Draft>({ deadline: '', maxTeams: '', rules: '', fee: '' });
	const [inbox, setInbox] = useState<RegistrationInbox | null>(null);
	const [saving, setSaving] = useState(false);
	const [confirming, setConfirming] = useState<'publish' | 'close' | null>(null);
	const [justPublished, setJustPublished] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);
	const [error, setError] = useState('');

	const load = useCallback(async () => {
		try {
			const [settingsRes, inboxRes] = await Promise.all([registrationApi.getSettings(kind, id), registrationApi.inbox(kind, id)]);
			setSettings(settingsRes.data);
			setDraft(draftOf(settingsRes.data));
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

	const terms = () => ({
		// The deadline is typed in Prague time and stored as an instant.
		deadline: fromZonedInput(draft.deadline),
		maxTeams: draft.maxTeams === '' ? null : Number(draft.maxTeams),
		rules: draft.rules.trim() || null,
		fee: draft.fee.trim() || null,
	});

	/** Saves the terms, and opens or closes the form when asked to. */
	const save = async (open?: boolean) => {
		setError('');
		setSaving(true);
		try {
			const res = await registrationApi.updateSettings(kind, id, { ...terms(), ...(open !== undefined && { open }) });
			setSettings(res.data);
			setDraft(draftOf(res.data));
			setConfirming(null);
			if (open === true) {
				setJustPublished(true);
				setTimeout(() => document.getElementById('registrations-share')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
			}
			if (open === false) setJustPublished(false);
			if (open !== undefined) onLifecycleChanged?.(res.data.lifecycle);
			// A changed maximum moves applications between places and the waiting list.
			setInbox((await registrationApi.inbox(kind, id)).data);
		} catch (err) {
			fail(err, 'registrations.saveError');
		} finally {
			setSaving(false);
		}
	};

	const decide = async (registration: Registration, action: 'approve' | 'waitlist' | 'reject' | 'promote', reason?: string) => {
		setError('');
		setBusyId(registration.id);
		try {
			if (action === 'approve') await registrationApi.approve(registration.id);
			if (action === 'waitlist') await registrationApi.waitlist(registration.id);
			if (action === 'reject') await registrationApi.reject(registration.id, reason);
			if (action === 'promote') await registrationApi.promote(registration.id);
			setRejecting(null);
			await load();
			if (action === 'approve') onTeamsChanged?.();
		} catch (err) {
			fail(err, 'registrations.decideError');
		} finally {
			setBusyId(null);
		}
	};

	if (!settings || !inbox) {
		return <p className="text-sm text-muted-foreground">{error || t('common.loading')}</p>;
	}

	const saved = draftOf(settings);
	const dirty = (Object.keys(draft) as (keyof Draft)[]).some((key) => draft[key] !== saved[key]);
	const lifecycle = settings.lifecycle;
	const live = lifecycle === 'OPEN' || lifecycle === 'FULL' || lifecycle === 'PAST_DEADLINE';
	const capacity = inbox.capacity;
	const waiting = inbox.registrations.filter((r) => r.status === 'PENDING' || r.status === 'WAITLISTED');
	const waitlist = inbox.registrations.filter((r) => r.status === 'WAITLISTED');
	const decided = inbox.registrations.filter((r) => r.status !== 'PENDING' && r.status !== 'WAITLISTED');
	const canPromote = capacity.free === null || capacity.free > 0;
	const field = 'h-11 w-full rounded-[10px] border border-border bg-input-background px-3 text-[14.5px]';
	const ghost = 'flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-border px-4 text-[14px] font-semibold disabled:opacity-50';
	const primary = 'flex h-11 items-center justify-center gap-1.5 rounded-[10px] px-4 text-[14px] font-semibold text-white disabled:opacity-50';
	const previewPath = `/prihlaska/${REGISTRATION_SLUG[kind]}/${id}?preview=1`;

	const checklist = [
		{ key: 'deadline', done: draft.deadline !== '', warn: true },
		{ key: 'capacity', done: draft.maxTeams !== '', warn: true },
		{ key: 'rules', done: draft.rules.trim() !== '', warn: false },
		{ key: 'fee', done: draft.fee.trim() !== '', warn: false },
	];

	const confirmFacts = [
		{ label: t('registrations.confirm.competition'), value: settings.competitionName },
		{ label: t('registrations.confirm.deadline'), value: formatDeadline(fromZonedInput(draft.deadline), i18n.language) ?? t('registrations.confirm.noDeadline') },
		{ label: t('registrations.confirm.capacity'), value: draft.maxTeams ? t('registrations.confirm.teams', { count: Number(draft.maxTeams) }) : t('registrations.confirm.noLimit') },
		{ label: t('registrations.confirm.fee'), value: draft.fee.trim() || t('registrations.confirm.noFee') },
		{ label: t('registrations.confirm.link'), value: registrationLink(kind, id) },
	];

	const card = (registration: Registration) => {
		const tone = STATUS_TONE[registration.status];
		const open = registration.status === 'PENDING' || registration.status === 'WAITLISTED';
		const busy = busyId === registration.id;
		const position = registration.status === 'WAITLISTED' ? waitlist.indexOf(registration) + 1 : null;
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
						{position ? t('registrations.waitlistPosition', { position }) : t(`registrations.status.${registration.status}`)}
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
					{registration.promotedOutOfOrder && registration.promotedAt && (
						<p className="text-[12px] text-muted-foreground">
							{t('registrations.promotedOutOfOrder', {
								name: registration.promotedBy?.name ?? t('registrations.someone'),
								date: formatDateShort(registration.promotedAt, i18n.language),
							})}
						</p>
					)}
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
							{registration.status === 'WAITLISTED' && canPromote ? (
								<button type="button" disabled={busy} onClick={() => void decide(registration, 'promote')} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-[13.5px] font-semibold text-white disabled:opacity-60" style={{ backgroundColor: accent }}>
									<ArrowUp className="size-4" aria-hidden />{t('registrations.promote')}
								</button>
							) : (
								<button type="button" disabled={busy} onClick={() => void decide(registration, 'approve')} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-[13.5px] font-semibold text-white disabled:opacity-60" style={{ backgroundColor: accent }}>
									<Check className="size-4" aria-hidden />{t('registrations.approve')}
								</button>
							)}
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

			{/* Where the form stands, and the one action that moves it on. */}
			<section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm">
				<div className="flex items-start gap-3">
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						<span
							className="self-start rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
							style={{ backgroundColor: LIFECYCLE_TONE[lifecycle].bg, color: LIFECYCLE_TONE[lifecycle].fg }}
						>
							{t(`registrations.lifecycle.${lifecycle}`)}
						</span>
						<p className="text-[13.5px] text-muted-foreground">{t(`registrations.lifecycleHint.${lifecycle}`)}</p>
					</div>
				</div>

				{justPublished && live && (
					<div role="status" className="flex items-start gap-2.5 rounded-[10px] bg-green-50 p-3 text-[13.5px] text-green-900">
						<CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
						<span className="flex flex-col gap-0.5">
							<span className="font-semibold">{t('registrations.published')}</span>
							<span>{t('registrations.publishedHint')}</span>
						</span>
					</div>
				)}

				{confirming === 'publish' ? (
					<div className="flex flex-col gap-3 rounded-[10px] border border-border p-3">
						<span className="text-[14px] font-semibold">{t('registrations.confirm.publishTitle')}</span>
						<dl className="grid gap-1.5 text-[13px]">
							{confirmFacts.map((fact) => (
								<div key={fact.label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
									<dt className="text-muted-foreground">{fact.label}</dt>
									<dd className="break-words font-medium">{fact.value}</dd>
								</div>
							))}
						</dl>
						<div className="flex gap-2">
							<button type="button" disabled={saving} onClick={() => void save(true)} className={`${primary} flex-1`} style={{ backgroundColor: accent }}>
								{t('registrations.confirm.publish')}
							</button>
							<button type="button" onClick={() => setConfirming(null)} className={`${ghost} flex-1`}>{t('common.cancel')}</button>
						</div>
					</div>
				) : confirming === 'close' ? (
					<div className="flex flex-col gap-3 rounded-[10px] border border-border p-3">
						<span className="text-[14px] font-semibold">{t('registrations.confirm.closeTitle')}</span>
						<p className="text-[13px] text-muted-foreground">{t('registrations.confirm.closeText')}</p>
						<div className="flex gap-2">
							<button type="button" disabled={saving} onClick={() => void save(false)} className="flex h-11 flex-1 items-center justify-center rounded-[10px] bg-red-700 text-[14px] font-semibold text-white disabled:opacity-50">
								{t('registrations.close')}
							</button>
							<button type="button" onClick={() => setConfirming(null)} className={`${ghost} flex-1`}>{t('common.cancel')}</button>
						</div>
					</div>
				) : live ? (
					<button type="button" onClick={() => setConfirming('close')} className={`${ghost} self-start`}>{t('registrations.close')}</button>
				) : (
					<button type="button" onClick={() => setConfirming('publish')} className={`${primary} self-start`} style={{ backgroundColor: accent }}>
						{lifecycle === 'CLOSED' ? t('registrations.reopen') : t('registrations.publish')}
					</button>
				)}
			</section>

			{/* The terms applicants see. */}
			<section className="flex flex-col gap-3">
				<span className="tm-section-label">{t('registrations.terms')}</span>
				<ul className="flex flex-wrap gap-1.5">
					{checklist.map((item) => (
						<li
							key={item.key}
							className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${
								item.done ? 'bg-green-50 text-green-800' : item.warn ? 'bg-amber-50 text-amber-800' : 'bg-muted text-muted-foreground'
							}`}
						>
							{item.done ? <Check className="size-3.5" aria-hidden /> : item.warn ? <AlertTriangle className="size-3.5" aria-hidden /> : null}
							{t(`registrations.checklist.${item.key}`)}
						</li>
					))}
				</ul>
				{checklist.filter((item) => item.warn && !item.done).map((item) => (
					<p key={item.key} className="text-[12.5px] text-amber-800">{t(`registrations.checklistWarn.${item.key}`)}</p>
				))}
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
				<div className="flex flex-wrap gap-2">
					<button type="button" disabled={!dirty || saving} onClick={() => void save()} className={`${primary} flex-1`} style={{ backgroundColor: accent }}>
						{t('registrations.save')}
					</button>
					{dirty ? (
						<span className={`${ghost} flex-1 cursor-not-allowed opacity-50`} aria-disabled title={t('registrations.previewSaveFirst')}>
							<Eye className="size-4" aria-hidden />{t('registrations.preview')}
						</span>
					) : (
						<a href={previewPath} target="_blank" rel="noreferrer" className={`${ghost} flex-1`}>
							<Eye className="size-4" aria-hidden />{t('registrations.preview')}
						</a>
					)}
				</div>
				{dirty && <p className="text-[12.5px] text-muted-foreground">{t('registrations.previewSaveFirst')}</p>}
			</section>

			{live ? (
				<SharePanel kind={kind} id={id} name={settings.competitionName} deadline={settings.deadline} accent={accent} />
			) : (
				<section className="flex flex-col gap-1.5">
					<span className="tm-section-label">{t('registrations.link')}</span>
					<p className="text-[12.5px] text-muted-foreground">{t('registrations.linkHintClosed')}</p>
				</section>
			)}

			<section className="flex flex-col gap-2.5">
				<span className="tm-section-label">{t('registrations.inbox')}</span>
				<div className="grid grid-cols-4 gap-2">
					{[
						{ key: 'approved', value: capacity.approved, tone: STATUS_TONE.APPROVED },
						{ key: 'pending', value: capacity.pending, tone: STATUS_TONE.PENDING },
						{ key: 'waitlisted', value: capacity.waitlisted, tone: STATUS_TONE.WAITLISTED },
						{ key: 'max', value: capacity.max ?? '–', tone: STATUS_TONE.WITHDRAWN },
					].map((tile) => (
						<div key={tile.key} className="flex flex-col items-center gap-0.5 rounded-[10px] px-1 py-2 text-center" style={{ backgroundColor: tile.tone.bg, color: tile.tone.fg }}>
							<span className="text-[18px] font-bold tabular-nums">{tile.value}</span>
							<span className="text-[11px] font-medium leading-tight">{t(`registrations.capacity.${tile.key}`)}</span>
						</div>
					))}
				</div>
				{capacity.max === null && <p className="text-[12px] text-muted-foreground">{t('registrations.capacity.noLimit')}</p>}

				{waitlist.length > 0 && capacity.free !== null && capacity.free > 0 && (
					<div className="flex flex-col gap-2 rounded-[10px] p-3 text-[13.5px]" style={{ backgroundColor: STATUS_TONE.WAITLISTED.bg, color: STATUS_TONE.WAITLISTED.fg }}>
						<span>{t('registrations.freePlaces', { count: capacity.free, waiting: waitlist.length })}</span>
						<button
							type="button"
							disabled={busyId !== null}
							onClick={() => void decide(waitlist[0], 'promote')}
							className={`${primary} self-start`}
							style={{ backgroundColor: accent }}
						>
							<ArrowUp className="size-4" aria-hidden />{t('registrations.promoteNext', { team: waitlist[0].teamName })}
						</button>
					</div>
				)}

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
