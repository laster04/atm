import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { CalendarClock, CheckCircle2, Coins, Eye, Plus, Users, X } from 'lucide-react';
import { registrationApi, teamApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PublicHero } from '@/components/public';
import type { Registration, RegistrationForm, RegistrationKind, RosterEntry, Team } from '@types';
import { formatDeadline } from '@/utils/date';

const newToken = () =>
	typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** The public URL speaks Czech (/prihlaska/sezona/…); the API speaks English. */
const KIND_BY_SLUG: Record<string, RegistrationKind> = { sezona: 'season', turnaj: 'tournament' };

type Field = 'teamName' | 'contactName' | 'email' | 'acceptRules' | 'roster';

/**
 * Where a team applies to a season or a tournament. A season application
 * comes from a signed-in user, who manages the team once it is approved; a
 * tournament takes an email address and, optionally, the roster.
 */
export default function RegistrationScreen() {
	const { kind: slug = '', id = '' } = useParams<{ kind: string; id: string }>();
	const kind = KIND_BY_SLUG[slug];
	const { t, i18n } = useTranslation();
	const { user } = useAuth();
	// The manager's preview: the form as applicants will see it, whatever its
	// state, with nothing sent. Only someone who may manage it gets that far;
	// the settings call answers 403 to anyone else.
	const [searchParams] = useSearchParams();
	const [preview, setPreview] = useState(false);

	const [form, setForm] = useState<RegistrationForm | null>(null);
	const [loadError, setLoadError] = useState(false);
	const [myTeams, setMyTeams] = useState<Team[]>([]);
	const [existingTeamId, setExistingTeamId] = useState('');
	const [teamName, setTeamName] = useState('');
	const [primaryColor, setPrimaryColor] = useState('#0F172A');
	const [contactName, setContactName] = useState(user?.name ?? '');
	const [email, setEmail] = useState(user?.email ?? '');
	const [phone, setPhone] = useState('');
	const [note, setNote] = useState('');
	const [roster, setRoster] = useState<{ name: string; number: string }[]>([]);
	const [acceptRules, setAcceptRules] = useState(false);
	const [website, setWebsite] = useState('');
	const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
	const [sendError, setSendError] = useState('');
	const [sending, setSending] = useState(false);
	const [sent, setSent] = useState<Registration | null>(null);
	// One token per application, so a retried request is not a second application.
	const token = useRef(newToken());

	useDocumentTitle([form?.name, t('registration.title')]);

	useEffect(() => {
		if (!kind) return;
		registrationApi.getForm(kind, id).then((res) => setForm(res.data)).catch(() => setLoadError(true));
	}, [kind, id]);

	useEffect(() => {
		if (!kind || !user || searchParams.get('preview') !== '1') return;
		registrationApi.getSettings(kind, id).then(() => setPreview(true)).catch(() => setPreview(false));
	}, [kind, id, user, searchParams]);

	// A returning team keeps its history: offer the teams this user manages.
	useEffect(() => {
		if (kind !== 'season' || !user) return;
		teamApi.getMyTeams().then((res) => setMyTeams(res.data)).catch(() => setMyTeams([]));
	}, [kind, user]);

	useEffect(() => {
		if (user) {
			setContactName((current) => current || user.name);
			setEmail((current) => current || user.email);
		}
	}, [user]);

	if (!kind || loadError) {
		return <div className="mx-auto max-w-[1080px] px-4 py-16 text-center text-muted-foreground">{t('registration.notFound')}</div>;
	}
	if (!form) {
		return <div className="mx-auto max-w-[1080px] px-4 py-16 text-center text-muted-foreground">{t('common.loading')}</div>;
	}

	const single = form.sport === 'TENNIS';
	const teamLabel = single ? t('registration.playerName') : t('registration.teamName');
	const competitionPath = kind === 'season' ? `/season-detail/${form.id}` : `/tournament/${form.id}`;
	const nextPath = `/prihlaska/${slug}/${form.id}`;

	const validate = () => {
		const next: Partial<Record<Field, string>> = {};
		if (!existingTeamId && !teamName.trim()) next.teamName = t('registration.errors.teamName');
		if (!contactName.trim()) next.contactName = t('registration.errors.contactName');
		if (kind === 'tournament' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('registration.errors.email');
		if (form.rules && !acceptRules) next.acceptRules = t('registration.errors.acceptRules');
		if (roster.some((row) => !row.name.trim() || (row.number !== '' && !/^\d{1,3}$/.test(row.number)))) {
			next.roster = t('registration.errors.roster');
		}
		setErrors(next);
		return Object.keys(next).length === 0;
	};

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (preview || sending || !validate()) return;
		setSendError('');
		setSending(true);
		try {
			const res = await registrationApi.submit(kind, form.id, {
				clientToken: token.current,
				...(existingTeamId ? { existingTeamId } : { teamName: teamName.trim(), primaryColor }),
				contactName: contactName.trim(),
				...(kind === 'tournament' && { email: email.trim() }),
				phone: phone.trim() || undefined,
				note: note.trim() || undefined,
				...(kind === 'tournament' && roster.length > 0 && {
					roster: roster.map((row): RosterEntry => ({ name: row.name.trim(), number: row.number === '' ? null : Number(row.number) })),
				}),
				acceptRules: form.rules ? acceptRules : undefined,
				locale: i18n.language.startsWith('en') ? 'en' : 'cs',
				website,
			});
			setSent(res.data);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setSendError(axiosError.response?.data?.error || t('registration.errors.send'));
		} finally {
			setSending(false);
		}
	};

	/** Marks a field the application cannot go without. */
	const required = <span className="text-destructive-strong" aria-hidden> *</span>;

	const inputClass = (field?: Field) =>
		`h-11 w-full rounded-lg border bg-input-background px-3.5 text-base outline-none focus:ring-2 focus:ring-ring sm:text-[15px] ${
			field && errors[field] ? 'border-destructive' : 'border-border'
		}`;

	const facts = [
		form.deadline && {
			icon: CalendarClock,
			text: t('registration.deadline', { date: formatDeadline(form.deadline, i18n.language) }),
		},
		form.capacity.max != null && {
			icon: Users,
			text: form.capacity.free
				? t('registration.freePlaces', { count: form.capacity.free, max: form.capacity.max })
				: t('registration.noFreePlaces', { max: form.capacity.max, waiting: form.capacity.waitlisted }),
		},
		form.fee && { icon: Coins, text: t('registration.fee', { fee: form.fee }) },
	].filter(Boolean) as { icon: typeof Users; text: string }[];

	return (
		<>
			<PublicHero
				kicker={form.parentName}
				title={t('registration.heading', { name: form.name })}
				subtitle={kind === 'season' ? t('registration.seasonIntro') : t('registration.tournamentIntro')}
				crumbs={[
					{ label: t('public.nav.home'), to: '/' },
					{ label: form.name, to: competitionPath },
					{ label: t('registration.title') },
				]}
			/>

			<div className="mx-auto grid max-w-[1080px] gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
				<div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
					{sent ? (
						<div role="status" className="flex flex-col items-start gap-3">
							<CheckCircle2 className="size-8 text-success-strong" aria-hidden />
							<h2 className="text-xl font-bold">
								{sent.status === 'WAITLISTED' ? t('registration.sentWaitlisted') : t('registration.sentTitle')}
							</h2>
							<p className="text-[15px] text-subtle-foreground">{t('registration.sentText', { email: sent.email })}</p>
							{sent.statusLink && (
								<p className="text-[15px] text-subtle-foreground">{t('registration.sentStatusText')}</p>
							)}
							<div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold">
								{sent.statusLink && (
									<a href={sent.statusLink} className="text-primary hover:underline">{t('registration.checkStatus')}</a>
								)}
								<Link to={competitionPath} className="text-primary hover:underline">{t('registration.backToCompetition')}</Link>
								{user && <Link to="/dashboard" className="text-primary hover:underline">{t('registration.toDashboard')}</Link>}
							</div>
						</div>
					) : form.state !== 'OPEN' && !preview ? (
						<div className="flex flex-col items-start gap-3">
							<h2 className="text-xl font-bold">
								{form.state === 'PAST_DEADLINE' ? t('registration.pastDeadline') : t('registration.closed')}
							</h2>
							<Link to={competitionPath} className="text-sm font-semibold text-primary hover:underline">{t('registration.backToCompetition')}</Link>
						</div>
					) : kind === 'season' && !user ? (
						<div className="flex flex-col items-start gap-3">
							<h2 className="text-xl font-bold">{t('registration.signInTitle')}</h2>
							<p className="text-[15px] text-subtle-foreground">{t('registration.signInText')}</p>
							<p className="text-[15px] text-subtle-foreground">{t('registration.signInReturn')}</p>
							<div className="mt-2 flex flex-wrap items-center gap-4">
								<Link
									to={`/login?next=${encodeURIComponent(nextPath)}`}
									className="flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-[15px] font-semibold text-primary-foreground"
								>
									{t('registration.signIn')}
								</Link>
								<Link to={`/register?next=${encodeURIComponent(nextPath)}`} className="text-sm font-semibold text-primary hover:underline">{t('registration.createAccount')}</Link>
							</div>
						</div>
					) : (
						<form onSubmit={submit} noValidate className="flex flex-col gap-6">
							{preview && (
								<div role="status" className="flex items-start gap-2.5 rounded-lg bg-ice px-4 py-3 text-sm font-medium text-navy">
									<Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
									<span>{form.state === 'OPEN' ? t('registration.previewOpen') : t('registration.previewClosed')}</span>
								</div>
							)}
							{sendError && (
								<div role="alert" className="rounded-lg bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive-strong">{sendError}</div>
							)}
							{/* Said before sending: where the application will land. */}
							{form.full ? (
								<div className="rounded-lg bg-warning-soft px-4 py-3 text-sm font-medium text-warning-strong">{t('registration.fullNote')}</div>
							) : form.capacity.free != null && (
								<p className="text-sm text-muted-foreground">{t('registration.placeNote', { count: form.capacity.free })}</p>
							)}
							<p className="text-[13px] text-muted-foreground">{t('registration.requiredNote')}</p>

							{kind === 'season' && myTeams.length > 0 && (
								<div className="flex flex-col gap-1.5">
									<label htmlFor="reg-existing" className="text-sm font-semibold">{t('registration.whichTeam')}</label>
									<select
										id="reg-existing"
										value={existingTeamId}
										onChange={(e) => setExistingTeamId(e.target.value)}
										className={inputClass()}
									>
										<option value="">{t('registration.newTeam')}</option>
										{myTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
									</select>
								</div>
							)}

							{!existingTeamId && (
								<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
									<div className="flex flex-col gap-1.5">
										<label htmlFor="reg-team" className="text-sm font-semibold">{teamLabel}{required}</label>
										<input
											id="reg-team"
											value={teamName}
											onChange={(e) => setTeamName(e.target.value)}
											maxLength={80}
											aria-invalid={!!errors.teamName}
											className={inputClass('teamName')}
										/>
										{errors.teamName && <p className="text-sm text-destructive-strong">{errors.teamName}</p>}
									</div>
									<div className="flex flex-col gap-1.5">
										<label htmlFor="reg-color" className="text-sm font-semibold">{t('registration.color')}</label>
										<input id="reg-color" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-11 w-full rounded-lg border border-border bg-input-background p-1" />
									</div>
								</div>
							)}

							<div className="grid gap-4 sm:grid-cols-2">
								<div className="flex flex-col gap-1.5">
									<label htmlFor="reg-contact" className="text-sm font-semibold">{t('registration.contactName')}{required}</label>
									<input id="reg-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={120} aria-invalid={!!errors.contactName} className={inputClass('contactName')} />
									{errors.contactName && <p className="text-sm text-destructive-strong">{errors.contactName}</p>}
								</div>
								{kind === 'tournament' && (
									<div className="flex flex-col gap-1.5">
										<label htmlFor="reg-email" className="text-sm font-semibold">{t('registration.email')}{required}</label>
										<input id="reg-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} className={inputClass('email')} />
										{errors.email && <p className="text-sm text-destructive-strong">{errors.email}</p>}
									</div>
								)}
								<div className="flex flex-col gap-1.5">
									<label htmlFor="reg-phone" className="text-sm font-semibold">{t('registration.phone')}</label>
									<input id="reg-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} className={inputClass()} />
								</div>
							</div>

							{kind === 'tournament' && !single && (
								<fieldset className="flex flex-col gap-2.5">
									<legend className="mb-1 text-sm font-semibold">{t('registration.roster')}</legend>
									<p className="text-[13px] text-muted-foreground">{t('registration.rosterHint')}</p>
									{roster.map((row, index) => (
										<div key={index} className="flex gap-2">
											<input
												aria-label={t('registration.rosterName', { n: index + 1 })}
												placeholder={t('registration.rosterNamePlaceholder')}
												value={row.name}
												onChange={(e) => setRoster((rows) => rows.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))}
												className={`${inputClass()} flex-1`}
											/>
											<input
												aria-label={t('registration.rosterNumber', { n: index + 1 })}
												placeholder="#"
												inputMode="numeric"
												value={row.number}
												onChange={(e) => setRoster((rows) => rows.map((r, i) => (i === index ? { ...r, number: e.target.value } : r)))}
												className={`${inputClass()} w-20`}
											/>
											<button
												type="button"
												onClick={() => setRoster((rows) => rows.filter((_, i) => i !== index))}
												className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border"
												aria-label={t('registration.rosterRemove')}
											>
												<X className="size-4" aria-hidden />
											</button>
										</div>
									))}
									{roster.length < 40 && (
										<button
											type="button"
											onClick={() => setRoster((rows) => [...rows, { name: '', number: '' }])}
											className="flex h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm font-semibold text-muted-foreground"
										>
											<Plus className="size-4" aria-hidden />
											{t('registration.rosterAdd')}
										</button>
									)}
									{errors.roster && <p className="text-sm text-destructive-strong">{errors.roster}</p>}
								</fieldset>
							)}

							<div className="flex flex-col gap-1.5">
								<label htmlFor="reg-note" className="text-sm font-semibold">{t('registration.note')}</label>
								<textarea id="reg-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className="w-full rounded-lg border border-border bg-input-background px-3.5 py-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-[15px]" />
							</div>

							{form.rules && (
								<div className="flex flex-col gap-2.5">
									<span className="text-sm font-semibold">{t('registration.rules')}</span>
									<div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-4 text-[14px] leading-relaxed">{form.rules}</div>
									<label className="flex cursor-pointer items-start gap-3">
										<input type="checkbox" checked={acceptRules} onChange={(e) => setAcceptRules(e.target.checked)} aria-invalid={!!errors.acceptRules} className="mt-0.5 size-5 shrink-0 accent-[rgb(var(--primary))]" />
										<span className="text-sm">{t('registration.acceptRules')}{required}</span>
									</label>
									{errors.acceptRules && <p className="text-sm text-destructive-strong">{errors.acceptRules}</p>}
								</div>
							)}

							{/* Hidden from people and screen readers; bots fill it in. */}
							<div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
								<label htmlFor="reg-website">Website</label>
								<input id="reg-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
							</div>

							<button
								type="submit"
								disabled={sending || preview}
								className="flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:self-start"
							>
								{sending ? t('registration.sending') : t('registration.submit')}
							</button>
						</form>
					)}
				</div>

				<aside className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
					<h2 className="text-[15px] font-bold">{t('registration.factsTitle')}</h2>
					{facts.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t('registration.noFacts')}</p>
					) : (
						facts.map((fact) => (
							<p key={fact.text} className="flex items-start gap-2.5 text-sm">
								<fact.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
								<span>{fact.text}</span>
							</p>
						))
					)}
					<p className="text-[13px] leading-snug text-muted-foreground">
						{kind === 'season' ? t('registration.seasonAfter') : t('registration.tournamentAfter')}
					</p>
				</aside>
			</div>
		</>
	);
}
