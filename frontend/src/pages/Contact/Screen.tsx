import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { CheckCircle2 } from 'lucide-react';
import { PublicHero } from '@/components/public';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { contactApi } from '@/services/api';
import type { SupportCategory } from '@types';

const CATEGORIES: SupportCategory[] = ['QUESTION', 'PROBLEM', 'COMPLAINT', 'IDEA'];
type Field = 'category' | 'subject' | 'message' | 'email';

const newToken = () =>
	typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function ContactScreen() {
	const { t } = useTranslation();
	const { user } = useAuth();
	useDocumentTitle([t('public.contact.title')]);

	const [category, setCategory] = useState<SupportCategory | null>(null);
	const [subject, setSubject] = useState('');
	const [message, setMessage] = useState('');
	const [email, setEmail] = useState(user?.email ?? '');
	const [withContext, setWithContext] = useState(false);
	const [website, setWebsite] = useState('');
	const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
	const [sendError, setSendError] = useState('');
	const [sending, setSending] = useState(false);
	const [sent, setSent] = useState(false);
	// One token per message: a retry after a failed request reuses it, so the
	// server can tell a retry from a second message.
	const token = useRef(newToken());
	const summaryRef = useRef<HTMLDivElement>(null);

	const validate = () => {
		const next: Partial<Record<Field, string>> = {};
		if (!category) next.category = t('public.contact.errors.category');
		if (subject.trim().length < 3) next.subject = t('public.contact.errors.subject');
		if (message.trim().length < 10) next.message = t('public.contact.errors.message');
		if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('public.contact.errors.email');
		setErrors(next);
		return next;
	};

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (sending) return;
		setSendError('');
		const found = validate();
		const first = (['category', 'subject', 'message', 'email'] as Field[]).find((field) => found[field]);
		if (first) {
			document.getElementById(`contact-${first}`)?.focus();
			return;
		}

		setSending(true);
		try {
			await contactApi.send({
				category: category!,
				subject: subject.trim(),
				message: message.trim(),
				email: email.trim() || undefined,
				clientToken: token.current,
				website,
				context: withContext
					? {
							page: window.location.pathname,
							viewport: `${window.innerWidth}x${window.innerHeight}`,
							userAgent: navigator.userAgent,
							signedIn: !!user,
						}
					: undefined,
			});
			setSent(true);
		} catch (error) {
			const status = (error as AxiosError).response?.status;
			setSendError(status === 429 ? t('public.contact.errors.tooMany') : t('public.contact.errors.send'));
			summaryRef.current?.focus();
		} finally {
			setSending(false);
		}
	};

	const reset = () => {
		token.current = newToken();
		setCategory(null);
		setSubject('');
		setMessage('');
		setWithContext(false);
		setErrors({});
		setSent(false);
	};

	const inputClass = (field: Field) =>
		`w-full rounded-lg border bg-input-background px-3.5 text-base outline-none focus:ring-2 focus:ring-ring sm:text-[15px] ${
			errors[field] ? 'border-destructive' : 'border-border'
		}`;

	return (
		<>
			<PublicHero
				title={t('public.contact.title')}
				subtitle={t('public.contact.subtitle')}
				crumbs={[{ label: t('public.nav.home'), to: '/' }, { label: t('public.contact.title') }]}
			/>

			<div className="mx-auto grid max-w-[1080px] gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
				<div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
					{sent ? (
						<div role="status" className="flex flex-col items-start gap-3">
							<CheckCircle2 className="size-8 text-success-strong" aria-hidden />
							<h2 className="text-xl font-bold">{t('public.contact.sentTitle')}</h2>
							<p className="text-[15px] text-subtle-foreground">
								{email.trim() ? t('public.contact.sentWithEmail') : t('public.contact.sentWithoutEmail')}
							</p>
							<button type="button" onClick={reset} className="mt-2 text-sm font-semibold text-primary hover:underline">
								{t('public.contact.sendAnother')}
							</button>
						</div>
					) : (
						<form onSubmit={submit} noValidate className="flex flex-col gap-6">
							<div ref={summaryRef} tabIndex={-1} className="outline-none">
								{sendError && (
									<div role="alert" className="rounded-lg bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive-strong">
										{sendError}
									</div>
								)}
							</div>

							<fieldset className="flex flex-col gap-2.5">
								<legend className="mb-2.5 text-sm font-semibold">{t('public.contact.categoryLegend')}</legend>
								<div className="grid gap-2.5 sm:grid-cols-2">
									{CATEGORIES.map((option, index) => {
										const active = category === option;
										return (
											<label
												key={option}
												className={`flex min-h-[72px] cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
													active ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-muted'
												}`}
											>
												<input
													id={index === 0 ? 'contact-category' : undefined}
													type="radio"
													name="category"
													value={option}
													checked={active}
													onChange={() => setCategory(option)}
													aria-describedby={errors.category ? 'contact-category-error' : undefined}
													className="mt-1 size-4 accent-[rgb(var(--primary))]"
												/>
												<span className="flex flex-col gap-0.5">
													<span className="text-[15px] font-semibold">{t(`public.contact.categories.${option}.title`)}</span>
													<span className="text-[13px] leading-snug text-muted-foreground">{t(`public.contact.categories.${option}.hint`)}</span>
												</span>
											</label>
										);
									})}
								</div>
								{errors.category && (
									<p id="contact-category-error" className="text-sm text-destructive-strong">{errors.category}</p>
								)}
							</fieldset>

							<div className="flex flex-col gap-1.5">
								<label htmlFor="contact-subject" className="text-sm font-semibold">{t('public.contact.subject')}</label>
								<input
									id="contact-subject"
									value={subject}
									onChange={(e) => setSubject(e.target.value)}
									maxLength={160}
									aria-invalid={!!errors.subject}
									aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
									className={`${inputClass('subject')} h-11`}
								/>
								{errors.subject && <p id="contact-subject-error" className="text-sm text-destructive-strong">{errors.subject}</p>}
							</div>

							<div className="flex flex-col gap-1.5">
								<label htmlFor="contact-message" className="text-sm font-semibold">{t('public.contact.message')}</label>
								<textarea
									id="contact-message"
									value={message}
									onChange={(e) => setMessage(e.target.value)}
									rows={6}
									maxLength={5000}
									aria-invalid={!!errors.message}
									aria-describedby={`contact-message-hint${errors.message ? ' contact-message-error' : ''}`}
									className={`${inputClass('message')} py-3`}
								/>
								<p id="contact-message-hint" className="text-[13px] text-muted-foreground">{t('public.contact.messageHint')}</p>
								{errors.message && <p id="contact-message-error" className="text-sm text-destructive-strong">{errors.message}</p>}
							</div>

							<div className="flex flex-col gap-1.5">
								<label htmlFor="contact-email" className="text-sm font-semibold">{t('public.contact.email')}</label>
								<input
									id="contact-email"
									type="email"
									inputMode="email"
									autoComplete="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									aria-invalid={!!errors.email}
									aria-describedby={`contact-email-hint${errors.email ? ' contact-email-error' : ''}`}
									className={`${inputClass('email')} h-11`}
								/>
								<p id="contact-email-hint" className="text-[13px] text-muted-foreground">{t('public.contact.emailHint')}</p>
								{errors.email && <p id="contact-email-error" className="text-sm text-destructive-strong">{errors.email}</p>}
							</div>

							{/* Hidden from people and screen readers; bots fill it in. */}
							<div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
								<label htmlFor="contact-website">Website</label>
								<input id="contact-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
							</div>

							<label className="flex cursor-pointer gap-3 rounded-xl bg-background p-4">
								<input
									type="checkbox"
									checked={withContext}
									onChange={(e) => setWithContext(e.target.checked)}
									className="mt-0.5 size-5 shrink-0 accent-[rgb(var(--primary))]"
								/>
								<span className="flex flex-col gap-1">
									<span className="text-sm font-semibold">{t('public.contact.contextLabel')}</span>
									<span className="text-[13px] leading-snug text-subtle-foreground">{t('public.contact.contextHint')}</span>
								</span>
							</label>

							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
								<button
									type="submit"
									disabled={sending}
									className="flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
								>
									{sending ? t('public.contact.sending') : t('public.contact.send')}
								</button>
								<span className="text-[13px] text-muted-foreground">{t('public.contact.noPasswords')}</span>
							</div>
						</form>
					)}
				</div>

				<aside className="flex flex-col gap-4">
					<div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
						<h2 className="text-[17px] font-bold">{t('public.contact.helpsTitle')}</h2>
						<ol className="flex flex-col gap-3">
							{(['what', 'happened', 'where'] as const).map((step, index) => (
								<li key={step} className="flex gap-3">
									<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-accent-foreground" aria-hidden>
										{index + 1}
									</span>
									<span className="flex flex-col gap-0.5">
										<span className="text-sm font-semibold">{t(`public.contact.helps.${step}.title`)}</span>
										<span className="text-[13px] text-subtle-foreground">{t(`public.contact.helps.${step}.hint`)}</span>
									</span>
								</li>
							))}
						</ol>
					</div>
					<Link to="/updates" className="rounded-2xl border border-border bg-card p-5 text-sm font-semibold text-primary hover:border-primary">
						{t('public.contact.seeUpdates')}
					</Link>
				</aside>
			</div>
		</>
	);
}
