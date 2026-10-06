import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Share, Smartphone, X } from 'lucide-react';
import {
	canPromptInstall,
	isIos,
	isStandalone,
	promptInstall,
	subscribeInstallPrompt,
} from '@/utils/installPrompt';

const DISMISSED_KEY = 'atm.installCard.dismissed';

const readDismissed = (): boolean => {
	try {
		return localStorage.getItem(DISMISSED_KEY) === '1';
	} catch {
		return false;
	}
};

/**
 * Offers to install ATM on the home screen. Android and desktop get the
 * browser's own install dialog; an iPhone has none, so it gets the two taps
 * that do it. Hidden inside the installed app and once dismissed.
 */
export default function InstallAppCard() {
	const { t } = useTranslation();
	const promptable = useSyncExternalStore(subscribeInstallPrompt, canPromptInstall, () => false);
	const [dismissed, setDismissed] = useState(readDismissed);

	if (dismissed || isStandalone()) return null;
	const ios = isIos();
	if (!promptable && !ios) return null;

	const dismiss = () => {
		setDismissed(true);
		try {
			localStorage.setItem(DISMISSED_KEY, '1');
		} catch {
			// Private mode: it simply comes back next visit.
		}
	};

	return (
		<div className="mb-8 flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
			<Smartphone className="size-5 shrink-0 text-muted-foreground" aria-hidden />
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="text-[14.5px] font-semibold">{t('home.installApp.title')}</span>
				<span className="text-[12.5px] text-muted-foreground">
					{ios ? (
						<>
							{t('home.installApp.iosBefore')}{' '}
							<Share className="inline size-3.5 -translate-y-px" aria-label={t('home.installApp.share')} />{' '}
							{t('home.installApp.iosAfter')}
						</>
					) : (
						t('home.installApp.hint')
					)}
				</span>
			</span>
			{promptable && (
				<button
					onClick={() => void promptInstall()}
					className="flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] font-semibold text-white"
					style={{ backgroundColor: '#0F172A' }}
				>
					<Download className="size-4" aria-hidden />
					{t('home.installApp.install')}
				</button>
			)}
			<button
				onClick={dismiss}
				className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
				aria-label={t('home.installApp.dismiss')}
			>
				<X className="size-4" aria-hidden />
			</button>
		</div>
	);
}
