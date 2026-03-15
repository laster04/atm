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

			<div className="container mx-auto px-4 py-4">
				<Card className="admin-card">
					<CardContent className="admin-card-content">
						{/* Mobile Menu Button */}
						<div className="admin-mobile-menu-btn lg:hidden mb-3">
							<button
								onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
								className="admin-menu-toggle"
								aria-label="Toggle menu"
							>
								{mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
							</button>
						</div>

						{/* Navigation */}
						<nav className={cn(
							'admin-nav',
							mobileMenuOpen ? 'admin-nav-mobile-open' : 'admin-nav-mobile-closed'
						)}>
							{tabs.map((tab) => (
								<NavLink
									key={tab.to}
									to={tab.to}
									onClick={handleTabClick}
									className={({ isActive }) =>
										cn(
											'admin-nav-link',
											isActive ? 'admin-nav-link-active' : 'admin-nav-link-inactive'
										)
									}
								>
									{tab.label}
								</NavLink>
							))}
						</nav>

						{/* Page Content */}
						<div className="admin-page-content">
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
