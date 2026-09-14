import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, LogOut, Menu, UserCircle, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@components/base/dropdown-menu';
import SearchBox from './SearchBox';
import logoImage from '@/assets/logo-full.png';

/** The competition entries live behind one menu; the rest are flat links. */
const COMPETITIONS = [
	{ to: '/leagues', key: 'public.nav.leagues' },
	{ to: '/seasons', key: 'public.nav.seasons' },
	{ to: '/tournaments', key: 'public.nav.tournaments' },
];

const SECTIONS = [
	{ to: '/teams', key: 'public.nav.teams' },
	{ to: '/players', key: 'public.nav.players' },
	{ to: '/games', key: 'public.nav.games' },
	{ to: '/stats', key: 'public.nav.stats' },
	{ to: '/about', key: 'public.nav.about' },
];

interface PublicHeaderProps {
	/**
	 * The landing page puts the header on top of its hero, where a white bar
	 * would cut the photograph in half.
	 */
	variant?: 'solid' | 'overlay';
}

export default function PublicHeader({ variant = 'solid' }: PublicHeaderProps) {
	const { t, i18n } = useTranslation();
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const [mobileOpen, setMobileOpen] = useState(false);

	const overlay = variant === 'overlay';

	const handleLogout = () => {
		logout();
		navigate('/');
	};

	const toggleLanguage = () => i18n.changeLanguage(i18n.language === 'en' ? 'cs' : 'en');

	const linkClass = ({ isActive }: { isActive: boolean }) =>
		[
			'rounded-lg px-3 py-2 text-sm transition-colors',
			isActive
				? overlay ? 'bg-white/15 font-semibold text-white' : 'bg-accent font-semibold text-accent-foreground'
				: overlay ? 'font-medium text-white/85 hover:text-white' : 'font-medium text-subtle-foreground hover:text-foreground',
		].join(' ');

	return (
		<header
			className={
				overlay
					? 'absolute inset-x-0 top-0 z-30'
					: 'sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm'
			}
		>
			<div className="mx-auto flex h-[68px] max-w-[1600px] items-center gap-6 px-4 py-3 sm:px-8">
				<Link to="/" className="shrink-0">
					<img src={logoImage} alt="ATM" className="h-8 w-auto sm:h-9" />
				</Link>

				<nav className="hidden flex-1 items-center gap-1 lg:flex">
					<DropdownMenu>
						<DropdownMenuTrigger
							className={[
								'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors',
								overlay ? 'text-white/85 hover:text-white' : 'text-subtle-foreground hover:text-foreground',
							].join(' ')}
						>
							{t('public.nav.competitions')}
							<ChevronDown className="size-3.5" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-48">
							{COMPETITIONS.map((item) => (
								<DropdownMenuItem key={item.to} asChild>
									<Link to={item.to}>{t(item.key)}</Link>
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					{SECTIONS.map((item) => (
						<NavLink key={item.to} to={item.to} className={linkClass}>
							{t(item.key)}
						</NavLink>
					))}
				</nav>

				<SearchBox tone={overlay ? 'dark' : 'light'} className="ml-auto hidden w-64 xl:block" />

				<div className="ml-auto flex items-center gap-2 xl:ml-0">
					<button
						type="button"
						onClick={toggleLanguage}
						className={[
							'hidden h-10 items-center rounded-lg px-3 text-sm font-semibold transition-colors sm:flex',
							overlay ? 'text-white/85 hover:text-white' : 'text-subtle-foreground hover:text-foreground',
						].join(' ')}
					>
						{i18n.language === 'en' ? 'EN' : 'CZ'}
					</button>

					{user ? (
						<DropdownMenu>
							<DropdownMenuTrigger
								className={[
									'flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold outline-none transition-colors',
									overlay ? 'text-white hover:bg-white/10' : 'text-foreground hover:bg-muted',
								].join(' ')}
							>
								<UserCircle className="size-5" />
								<span className="hidden max-w-32 truncate sm:block">{user.name}</span>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuLabel>
									<div className="flex flex-col gap-1">
										<span className="text-sm font-medium">{t('nav.loggedInAs')}</span>
										<span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link to="/dashboard">{t('public.nav.dashboard')}</Link>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={handleLogout}>
									<LogOut className="mr-2 size-4" />
									{t('nav.logout')}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<Link
							to="/login"
							className={[
								'flex h-10 items-center rounded-lg px-4 text-sm font-semibold transition-opacity hover:opacity-90',
								overlay ? 'bg-card text-foreground' : 'bg-primary text-primary-foreground',
							].join(' ')}
						>
							{t('public.nav.signIn')}
						</Link>
					)}

					<button
						type="button"
						onClick={() => setMobileOpen((open) => !open)}
						aria-label={t('nav.toggleMenu')}
						className={[
							'flex size-11 items-center justify-center rounded-lg lg:hidden',
							overlay ? 'text-white' : 'text-foreground',
						].join(' ')}
					>
						{mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
					</button>
				</div>
			</div>

			{mobileOpen && (
				<div className="border-t border-border bg-card px-4 pb-4 pt-3 lg:hidden">
					<SearchBox className="mb-3" />
					<nav className="flex flex-col">
						{[...COMPETITIONS, ...SECTIONS].map((item) => (
							<NavLink
								key={item.to}
								to={item.to}
								onClick={() => setMobileOpen(false)}
								className={({ isActive }) =>
									`flex min-h-11 items-center rounded-lg px-3 text-sm ${
										isActive ? 'bg-accent font-semibold text-accent-foreground' : 'font-medium text-subtle-foreground'
									}`
								}
							>
								{t(item.key)}
							</NavLink>
						))}
					</nav>
				</div>
			)}
		</header>
	);
}
