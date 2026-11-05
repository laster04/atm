import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { billingApi } from '@/services/api';

const newToken = () =>
	typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'idle' | 'clicked' | 'sent';

/**
 * The Liga plan before it is on sale: the model without a price, and a
 * "Mám zájem" button that counts who would want it. After the click an
 * optional form asks how to reach them; the click is recorded either way.
 */
export default function LeaguePlanInterest() {
	const { t } = useTranslation();
	const { user } = useAuth();
	const token = useRef(newToken());
	const [step, setStep] = useState<Step>('idle');
	const [email, setEmail] = useState(user?.email ?? '');
	const [leagueName, setLeagueName] = useState('');
	const [teamCount, setTeamCount] = useState('');
	const [website, setWebsite] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [sending, setSending] = useState(false);

	const points = t('public.landing.pricing.league.points', { returnObjects: true }) as string[];

	const click = () => {
		setStep('clicked');
		// A lost click costs one count, never the visitor's form, so it is not retried.
		billingApi.interest({ plan: 'LEAGUE', clientToken: token.current }).catch((err) => console.error(err));
	};

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const cleanEmail = email.trim();
		const teams = teamCount.trim() === '' ? undefined : Number(teamCount);
		if (cleanEmail && !EMAIL_PATTERN.test(cleanEmail)) {
			setError(t('public.landing.pricing.league.emailInvalid'));
			return;
		}
		if (teams !== undefined && (!Number.isInteger(teams) || teams < 1 || teams > 500)) {
			setError(t('public.landing.pricing.league.teamsInvalid'));
			return;
		}
		setError(null);
		setSending(true);
		try {
			await billingApi.interest({
				plan: 'LEAGUE',
				clientToken: token.current,
				email: cleanEmail || undefined,
				leagueName: leagueName.trim() || undefined,
				teamCount: teams,
				website,
			});
			setStep('sent');
		} catch {
			setError(t('public.landing.pricing.league.sendError'));
		} finally {
			setSending(false);
		}
	};

	const inputClass = 'h-11 w-full rounded-lg border border-border bg-input-background px-3.5 text-base outline-none focus:ring-2 focus:ring-ring sm:text-[15px]';

	return (
		<article aria-labelledby="league-plan-title" className="mt-4 grid gap-6 rounded-2xl border border-border bg-card p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
			<div className="flex flex-col gap-4">
				<div className="flex flex-wrap items-center gap-2">
					<h3 id="league-plan-title" className="text-lg font-extrabold">{t('public.landing.pricing.league.name')}</h3>
					<span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
						{t('public.landing.pricing.league.priceSoon')}
					</span>
				</div>
				<p className="text-[13px] text-subtle-foreground">{t('public.landing.pricing.league.for')}</p>
				<ul className="flex flex-col gap-2">
					{points.map((point) => (
						<li key={point} className="flex items-start gap-2 text-sm">
							<Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
							<span>{point}</span>
						</li>
					))}
				</ul>
			</div>

			<div className="flex flex-col justify-center gap-3" aria-live="polite">
				{step === 'idle' && (
					<>
						<p className="text-sm text-subtle-foreground">{t('public.landing.pricing.league.ask')}</p>
						<button
							type="button"
							onClick={click}
							className="flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
						>
							{t('public.landing.pricing.league.interested')}
						</button>
					</>
				)}

				{step === 'clicked' && (
					<form onSubmit={submit} noValidate className="relative flex flex-col gap-3">
						<p className="text-sm font-semibold">{t('public.landing.pricing.league.thanksClick')}</p>
						<p className="text-[13px] text-subtle-foreground">{t('public.landing.pricing.league.formHint')}</p>
						<div className="flex flex-col gap-1.5">
							<label htmlFor="league-interest-email" className="text-sm font-semibold">{t('public.landing.pricing.league.email')}</label>
							<input
								id="league-interest-email"
								type="email"
								inputMode="email"
								autoComplete="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className={inputClass}
							/>
						</div>
						<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
							<div className="flex flex-col gap-1.5">
								<label htmlFor="league-interest-name" className="text-sm font-semibold">{t('public.landing.pricing.league.leagueName')}</label>
								<input
									id="league-interest-name"
									autoComplete="organization"
									maxLength={120}
									value={leagueName}
									onChange={(e) => setLeagueName(e.target.value)}
									className={inputClass}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<label htmlFor="league-interest-teams" className="text-sm font-semibold">{t('public.landing.pricing.league.teams')}</label>
								<input
									id="league-interest-teams"
									type="number"
									inputMode="numeric"
									min={1}
									max={500}
									value={teamCount}
									onChange={(e) => setTeamCount(e.target.value)}
									className={inputClass}
								/>
							</div>
						</div>

						{/* Hidden from people and screen readers; bots fill it in. */}
						<div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
							<label htmlFor="league-interest-website">Website</label>
							<input id="league-interest-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
						</div>

						{error && <p className="text-sm text-destructive-strong">{error}</p>}
						<button
							type="submit"
							disabled={sending}
							className="flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
						>
							{t('public.landing.pricing.league.send')}
						</button>
						<p className="text-[12.5px] text-muted-foreground">{t('public.landing.pricing.league.privacy')}</p>
					</form>
				)}

				{step === 'sent' && (
					<p className="flex items-start gap-2 text-sm font-semibold">
						<Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
						{t('public.landing.pricing.league.thanksSent')}
					</p>
				)}
			</div>
		</article>
	);
}
