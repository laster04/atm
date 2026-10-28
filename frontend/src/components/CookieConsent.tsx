import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

declare global {
	interface Window {
		gtag?: (...args: unknown[]) => void;
	}
}

/** Read early by the Google tag in index.html too; keep the two in step. */
const STORAGE_KEY = 'atm-cookie-consent';

/** Fired by the footer's "Cookie settings" link to bring the banner back. */
export const COOKIE_SETTINGS_EVENT = 'atm:cookie-settings';

type Choice = 'granted' | 'denied';

const stored = (): Choice | null => {
	try {
		const value = localStorage.getItem(STORAGE_KEY);
		return value === 'granted' || value === 'denied' ? value : null;
	} catch {
		return null;
	}
};

export function openCookieSettings() {
	window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}

/**
 * Asks once whether Google Ads may set its cookies. Until the visitor agrees
 * the tag runs in Consent Mode with everything denied (see index.html).
 * Accept and decline are equally prominent, as the EU rules ask.
 */
export default function CookieConsent() {
	const { t } = useTranslation();
	const [open, setOpen] = useState(() => stored() === null);

	useEffect(() => {
		const reopen = () => setOpen(true);
		window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);
		return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen);
	}, []);

	const choose = (choice: Choice) => {
		try {
			localStorage.setItem(STORAGE_KEY, choice);
		} catch {
			// Private mode: the banner simply asks again next visit.
		}
		window.gtag?.('consent', 'update', {
			ad_storage: choice,
			ad_user_data: choice,
			ad_personalization: choice,
			analytics_storage: choice,
		});
		setOpen(false);
	};

	if (!open) return null;

	return (
		<section
			aria-label={t('cookieConsent.title')}
			className="fixed inset-x-0 bottom-0 z-50 p-4 print:hidden sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-md sm:p-0"
		>
			<div className="flex flex-col gap-3 rounded-2xl bg-navy p-5 text-white shadow-2xl">
				<h2 className="text-base font-bold">{t('cookieConsent.title')}</h2>
				<p className="text-sm leading-relaxed text-white/80">{t('cookieConsent.text')}</p>
				<div className="flex flex-col gap-2 sm:flex-row">
					<button
						type="button"
						onClick={() => choose('denied')}
						className="h-11 flex-1 rounded-lg border border-white/40 px-4 text-sm font-bold hover:bg-white/10"
					>
						{t('cookieConsent.decline')}
					</button>
					<button
						type="button"
						onClick={() => choose('granted')}
						className="h-11 flex-1 rounded-lg bg-brand px-4 text-sm font-bold text-brand-ink hover:opacity-90"
					>
						{t('cookieConsent.accept')}
					</button>
				</div>
			</div>
		</section>
	);
}
