import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, MoreHorizontal, Trophy, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '@/components/utils';
import ManagerHeader from '@/components/ManagerHeader';
import { ADMIN_GOLD, ADMIN_GOLD_INK } from './components/util';

export default function AdminLayout() {
	const { isAdmin, isSeasonManager } = useAuth();
	const { t } = useTranslation();
	const location = useLocation();

	if (!isAdmin() && !isSeasonManager()) {
		return (
			<div className="max-w-7xl mx-auto px-4 py-8 text-center">
				<h1 className="text-2xl font-bold text-red-600">{t('admin.accessDenied')}</h1>
				<p className="text-gray-600 mt-2">{t('admin.noPrivileges')}</p>
			</div>
		);
	}

	/**
	 * Four sections, not six. A team, a fixture and a player only exist inside a
	 * season, and the season manager screens already handle them there; what is
	 * left here is what is genuinely global — people, leagues, the season list
	 * itself, and the two cross-season views under More.
	 */
	const tabs = [
		...(isAdmin() ? [{ to: '/admin/users', label: t('admin.nav.users'), icon: Users }] : []),
		{ to: '/admin/leagues', label: t('admin.nav.leagues'), icon: Trophy },
		{ to: '/admin/seasons', label: t('admin.nav.seasons'), icon: CalendarDays },
		{ to: '/admin/more', label: t('admin.nav.more'), icon: MoreHorizontal },
	];

	const activeTab = tabs.find((tab) => location.pathname.startsWith(tab.to));

	return (
		<div className="flex min-h-screen flex-col bg-background lg:flex-row">
			{/* Desktop sidebar */}
			<div
				className="hidden border-r text-[#252525] shadow-sm lg:flex lg:w-64 lg:flex-col"
				style={{ backgroundColor: ADMIN_GOLD }}
			>
				<div className="border-b border-black/10 p-6">
					<h1 className="text-2xl font-bold">{t('admin.title')}</h1>
					<p className="mt-2 text-sm text-[#252525]/70">{t('admin.tabs.title')}</p>
				</div>
				<nav className="flex-1 space-y-2 p-4">
					{tabs.map((tab) => (
						<NavLink
							key={tab.to}
							to={tab.to}
							className={({ isActive }) =>
								cn(
									'flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-colors',
									isActive ? 'bg-black/15 font-semibold' : 'hover:bg-black/5'
								)
							}
						>
							<tab.icon className="size-5" />
							<span className="font-medium">{tab.label}</span>
						</NavLink>
					))}
				</nav>
			</div>

			<div className="flex flex-1 flex-col">
				{/* Phone header. Gold is light enough that the ink has to flip. */}
				<div className="lg:hidden">
					<ManagerHeader
						title={t('admin.title')}
						subtitle={activeTab?.label}
						backTo="/"
						color={ADMIN_GOLD}
						ink="dark"
					/>
				</div>

				<div className="hidden border-b bg-card lg:block">
					<div className="px-6 py-4">
						<h2 className="text-xl font-semibold text-foreground">{activeTab?.label}</h2>
					</div>
				</div>

				<div className="tm-content flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
					<Outlet />
				</div>

				{/* Phone bottom navigation */}
				<div className="tm-bottom-nav lg:hidden">
					<div
						className="grid h-14"
						style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
					>
						{tabs.map((tab) => (
							<NavLink
								key={tab.to}
								to={tab.to}
								className={({ isActive }) =>
									cn('tm-bottom-nav-item', isActive && 'is-active')
								}
								style={({ isActive }) => (isActive ? { color: ADMIN_GOLD_INK } : undefined)}
							>
								<tab.icon className="size-5" />
								<span>{tab.label}</span>
							</NavLink>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

export function AdminIndex() {
	const { isAdmin } = useAuth();
	// A season manager's home is their own season screens, not the global tables.
	// The tables stay reachable by deep link for the CRUD not ported yet (leagues,
	// players); once that moves, the guard above can drop `isSeasonManager()`.
	return <Navigate to={isAdmin() ? '/admin/users' : '/season-management'} replace />;
}
