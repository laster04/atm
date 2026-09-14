import { Outlet } from 'react-router-dom';
import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';

/**
 * The shell every public page sits in. Pages render their own hero, so the
 * layout owns only the chrome above and below it.
 */
export default function PublicLayout() {
	return (
		<div className="flex min-h-screen flex-col bg-background">
			<PublicHeader />
			<main className="flex-1">
				<Outlet />
			</main>
			<PublicFooter />
		</div>
	);
}
