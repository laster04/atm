import { createContext, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import atmMark from '@/embed/atm-mark.png';

/**
 * Turnaj Plus pages (a tournament, its sign-up form and status page) show no
 * site header, menu or footer, only a small "Běží na ATM" credit. The page
 * knows its plan, the layout owns the chrome, so the page tells the layout.
 */
export const LightChromeContext = createContext<(light: boolean) => void>(() => undefined);

/** Asks the public layout for the light chrome while this page is shown. */
export function useLightChrome(light: boolean): void {
	const setLight = useContext(LightChromeContext);
	useEffect(() => {
		setLight(light);
		return () => setLight(false);
	}, [light, setLight]);
}

/** The credit that stays on a light page: small, at the bottom, linking to ATM. */
export function PoweredByAtm({ className = '' }: { className?: string }) {
	const { t } = useTranslation();
	return (
		<a
			href="/"
			className={`inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground ${className}`}
		>
			<img src={atmMark} alt="" width={20} height={16} className="h-4 w-auto" />
			{t('plus.poweredBy')}
		</a>
	);
}
