import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	ArrowLeft, ArrowUpRight, BadgePercent, CalendarDays, Folder, History, Inbox, LayoutDashboard,
	LifeBuoy, Medal, Menu, Receipt, Swords, Trophy, UserRound, Users, X, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '@/components/utils';
import ErrorBoundary from '@/components/ErrorBoundary';
import { adminApi } from '@/services/api';
import AdminSearch from './components/shell/AdminSearch';
import { ADMIN_GOLD, ADMIN_INK } from './components/util';

interface Section {
	key: string;
	icon: LucideIcon;
	/** Absent: the section arrives with a later celek and is listed, not linked. */
	to?: string;
	/** Opens a screen outside the administration. */
	external?: boolean;
	/** Which celek builds it. */
	comingIn?: 'B' | 'H';
}

/**
 * Every section of the administration, built or not, so the menu is the map.
 * Leagues, seasons, players, games and support still show their old screens
 * inside the new shell until celek H moves them onto the list component. There
 * is deliberately no Teams section: teams live inside a season or tournament.
 */
const SECTIONS: Section[] = [
	{ key: 'overview', icon: LayoutDashboard, to: '/admin' },
	{ key: 'payments', icon: Receipt, to: '/admin/payments' },
	{ key: 'pricing', icon: BadgePercent, to: '/admin/pricing' },
	{ key: 'users', icon: Users, to: '/admin/users' },
	{ key: 'leagues', icon: Trophy, to: '/admin/leagues' },
	{ key: 'seasons', icon: CalendarDays, to: '/admin/seasons' },
	{ key: 'tournaments', icon: Medal, to: '/tournament-management/series', external: true },
	{ key: 'players', icon: UserRound, to: '/admin/players' },
	{ key: 'games', icon: Swords, to: '/admin/games' },
	{ key: 'registrations', icon: Inbox, comingIn: 'H' },
	{ key: 'files', icon: Folder, comingIn: 'H' },
	{ key: 'support', icon: LifeBuoy, to: '/admin/support' },
	{ key: 'audit', icon: History, to: '/admin/audit' },
];

const sectionFor = (pathname: string) =>
	SECTIONS.filter((section) => section.to && !section.external)
		.sort((a, b) => b.to!.length - a.to!.length)
		.find((section) => pathname === section.to || pathname.startsWith(`${section.to}/`));

export default function AdminLayout() {
	const { isAdmin, user } = useAuth();
	const { t } = useTranslation();
	const location = useLocation();
	const [menuOpen, setMenuOpen] = useState(false);
	const [openTickets, setOpenTickets] = useState<number | null>(null);

	useEffect(() => setMenuOpen(false), [location.pathname]);

	useEffect(() => {
		if (!isAdmin()) return;
		adminApi.overview()
			.then((res) => setOpenTickets(res.data.queues.openTickets))
			.catch((error) => console.error(error));
	}, [isAdmin]);

	// Admin role only. Season managers have /season-management and /dashboard;
	// the API refuses them too, this only spares them a screen of errors.
	if (!isAdmin()) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-8 text-center">
				<h1 className="text-2xl font-bold text-destructive">{t('admin.accessDenied')}</h1>
				<p className="mt-2 text-muted-foreground">{t('admin.noPrivileges')}</p>
				<Link to="/dashboard" className="mt-4 inline-block font-semibold underline">{t('adminShell.toDashboard')}</Link>
			</div>
		);
	}

	const current = sectionFor(location.pathname);
	const badges: Record<string, number | null> = { support: openTickets };

	const nav = (
		<nav aria-label={t('adminShell.menuLabel')} className="flex flex-col gap-1">
			{SECTIONS.map((section) => {
				const label = t(`adminShell.sections.${section.key}.label`);
				const badge = badges[section.key];
				const inner = (
					<>
						<section.icon className="size-[18px] shrink-0" aria-hidden />
						<span className="min-w-0 flex-1 truncate">{label}</span>
						{section.comingIn && (
							<span className="rounded-full border border-[#252525]/40 px-1.5 text-[11px] font-bold">
								{t('adminShell.soon')}
							</span>
						)}
						{!!badge && (
							<span className="rounded-full bg-[#252525] px-1.5 text-[11px] font-bold text-white" aria-label={t('adminShell.badge', { count: badge })}>
								{badge}
							</span>
						)}
						{section.external && <ArrowUpRight className="size-3.5 shrink-0 opacity-70" aria-hidden />}
					</>
				);
				const base = 'flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold';
				if (!section.to) {
					return (
						<span key={section.key} aria-disabled className={cn(base, 'opacity-55')} title={t('adminShell.comingIn', { celek: section.comingIn })}>
							{inner}
						</span>
					);
				}
				return (
					<NavLink
						key={section.key}
						to={section.to}
						end={section.key === 'overview'}
						className={({ isActive }) => cn(base, isActive && !section.external ? 'bg-black/15' : 'hover:bg-black/5')}
					>
						{inner}
					</NavLink>
				);
			})}
		</nav>
	);

	const brand = (
		<div className="flex items-center gap-2.5 px-2.5 pb-4 pt-1">
			<span className="rounded-md px-2 py-1 text-sm font-extrabold" style={{ backgroundColor: ADMIN_INK, color: ADMIN_GOLD }}>ATM</span>
			<span className="text-[15px] font-bold">{t('adminShell.title')}</span>
		</div>
	);

	return (
		<div className="flex min-h-screen bg-background text-foreground">
			{/* Desktop sidebar */}
			<aside className="hidden w-60 shrink-0 flex-col gap-2 px-3 py-5 lg:flex" style={{ backgroundColor: ADMIN_GOLD, color: ADMIN_INK }}>
				{brand}
				{nav}
				<Link to="/dashboard" className="mt-auto flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold hover:bg-black/5">
					<ArrowLeft className="size-4" aria-hidden />
					{t('adminShell.toDashboard')}
				</Link>
			</aside>

			{/* Phone menu */}
			{menuOpen && (
				<div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal aria-label={t('adminShell.menuLabel')}>
					<button type="button" className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} aria-label={t('common.close')} />
					<div className="relative flex h-full w-72 max-w-[85vw] flex-col gap-2 overflow-y-auto px-3 py-4" style={{ backgroundColor: ADMIN_GOLD, color: ADMIN_INK }}>
						<div className="flex items-start justify-between">
							{brand}
							<button type="button" onClick={() => setMenuOpen(false)} className="flex size-11 items-center justify-center" aria-label={t('common.close')}>
								<X className="size-5" aria-hidden />
							</button>
						</div>
						{nav}
						<Link to="/dashboard" className="mt-auto flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold">
							<ArrowLeft className="size-4" aria-hidden />
							{t('adminShell.toDashboard')}
						</Link>
					</div>
				</div>
			)}

			<div className="flex min-w-0 flex-1 flex-col">
				<header className="flex flex-wrap items-end gap-3 border-b border-border bg-card px-4 py-3 lg:px-6">
					<button
						type="button"
						onClick={() => setMenuOpen(true)}
						className="flex size-11 items-center justify-center rounded-lg lg:hidden"
						style={{ backgroundColor: ADMIN_GOLD, color: ADMIN_INK }}
						aria-label={t('adminShell.openMenu')}
					>
						<Menu className="size-5" aria-hidden />
					</button>
					<AdminSearch />
					<span className="ml-auto hidden pb-2.5 text-sm font-semibold text-muted-foreground md:inline">
						{user?.email} · {t('admin.roles.ADMIN')}
					</span>
				</header>

				<main className="flex flex-1 flex-col gap-4 px-4 py-5 lg:px-6">
					{current && (
						<div className="flex flex-col gap-1">
							<h1 className="text-2xl font-extrabold lg:text-[28px]">{t(`adminShell.sections.${current.key}.label`)}</h1>
							<p className="text-sm text-muted-foreground">{t(`adminShell.sections.${current.key}.hint`)}</p>
						</div>
					)}
					<ErrorBoundary>
						<Outlet />
					</ErrorBoundary>
				</main>
			</div>
		</div>
	);
}
