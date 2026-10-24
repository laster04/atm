import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';
import ErrorBoundary from '../ErrorBoundary';
import { LightChromeContext, PoweredByAtm } from './chrome';

/**
 * The shell every public page sits in. Pages render their own hero, so the
 * layout owns only the chrome above and below it.
 */
export default function PublicLayout() {
	// A Turnaj Plus page switches this on for as long as it is shown.
	const [light, setLight] = useState(false);

	return (
		<LightChromeContext.Provider value={setLight}>
			<div className="flex min-h-screen flex-col bg-background">
				{!light && <PublicHeader />}
				<main className="flex-1">
					<ErrorBoundary>
						<Outlet />
					</ErrorBoundary>
				</main>
				{light ? (
					<footer className="flex justify-center border-t border-border px-4 py-5">
						<PoweredByAtm />
					</footer>
				) : (
					<PublicFooter />
				)}
			</div>
		</LightChromeContext.Provider>
	);
}
