import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent } from '@components/base/card';
import { cn } from '@/components/utils';
import ManagerHeader from '@/components/ManagerHeader';
import { Menu, X } from 'lucide-react';

export default function AdminLayout() {
	const { isAdmin, isSeasonManager } = useAuth();
	const { t } = useTranslation();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const location = useLocation();

	if (!isAdmin() && !isSeasonManager()) {
		return (
			<div className="max-w-7xl mx-auto px-4 py-8 text-center">
				<h1 className="text-2xl font-bold text-red-600">{t('admin.accessDenied')}</h1>
				<p className="text-gray-600 mt-2">{t('admin.noPrivileges')}</p>
			</div>
		);
	}

	const tabs = [
		...(isAdmin() ? [{ to: '/admin/users', label: t('admin.tabs.user.title') }] : []),
		{ to: '/admin/leagues', label: t('admin.tabs.league.title') },
		{ to: '/admin/seasons', label: t('admin.tabs.season.title') },
		{ to: '/admin/teams', label: t('admin.tabs.team.title') },
		{ to: '/admin/players', label: t('admin.tabs.player.title') },
		{ to: '/admin/games', label: t('admin.tabs.game.title') },
	];

	const handleTabClick = () => {
		setMobileMenuOpen(false);
	};

	return (
		<div className="min-h-screen bg-background">
			<ManagerHeader
				title={t('admin.title')}
				subtitle={t('admin.tabs.title')}
				backTo="/"
			/>

			<div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
				<Card className="admin-card">
					<CardContent className="admin-card-content p-3 sm:p-6">
						{/* Mobile Menu Button */}
						<div className="lg:hidden mb-4">
							<button
								onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
								className="p-2.5 rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
								aria-label="Toggle menu"
								aria-expanded={mobileMenuOpen}
							>
								{mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
							</button>
						</div>

						{/* Navigation */}
						<nav className={cn(
							'transition-all duration-200 ease-in-out',
							mobileMenuOpen
								? 'flex flex-col space-y-1 mb-4 gap-0 border-none'
								: 'hidden lg:flex lg:space-x-1 lg:border-b lg:border-border lg:mb-4 lg:overflow-x-auto'
						)}>
							{tabs.map((tab) => (
								<NavLink
									key={tab.to}
									to={tab.to}
									onClick={handleTabClick}
									className={({ isActive }) =>
										cn(
											'px-3.5 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap lg:rounded-t-md lg:px-4 lg:py-2',
											isActive
												? 'bg-muted text-foreground border-b-2 border-primary lg:border-b-2'
												: 'text-muted-foreground hover:bg-muted/50'
										)
									}
								>
									{tab.label}
								</NavLink>
							))}
						</nav>

						{/* Page Content */}
						<div className="admin-page-content mt-4 sm:mt-6">
							<Outlet />
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

export function AdminIndex() {
	const { isAdmin } = useAuth();
	return <Navigate to={isAdmin() ? '/admin/users' : '/admin/leagues'} replace />;
}
