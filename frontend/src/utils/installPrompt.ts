/**
 * The browser's offer to install ATM as an app.
 *
 * Chrome and Edge fire `beforeinstallprompt` once, early - often before the
 * screen that shows the install button has mounted - so it is caught at start-up
 * and held here until someone asks for it. Safari on iOS never fires it: there
 * the only way in is Share -> Add to Home Screen, which the card explains.
 */

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function captureInstallPrompt(): void {
	window.addEventListener('beforeinstallprompt', (event) => {
		// Keep the browser's own mini-bar away; the dashboard offers it instead.
		event.preventDefault();
		deferred = event as BeforeInstallPromptEvent;
		notify();
	});
	window.addEventListener('appinstalled', () => {
		deferred = null;
		notify();
	});
}

export function subscribeInstallPrompt(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export const canPromptInstall = (): boolean => deferred !== null;

/** Opens the browser's install dialog. The event is single-use either way. */
export async function promptInstall(): Promise<boolean> {
	if (!deferred) return false;
	const event = deferred;
	deferred = null;
	await event.prompt();
	const { outcome } = await event.userChoice;
	notify();
	return outcome === 'accepted';
}

/** Already running as the installed app. */
export const isStandalone = (): boolean =>
	window.matchMedia('(display-mode: standalone)').matches ||
	(navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone or iPad - iPadOS reports itself as a Mac with a touch screen. */
export const isIos = (): boolean =>
	/iphone|ipad|ipod/i.test(navigator.userAgent) ||
	(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
