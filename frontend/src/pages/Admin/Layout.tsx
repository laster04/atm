import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@components/base/card';
import { cn } from '@/components/utils';

export default function AdminLayout() {
	const { isAdmin, isSeasonManager } = useAuth();
	const { t } = useTranslation();

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

	return (
		<div className="space-y-6">
			<h1 className="text-3xl font-bold mb-6">{t('admin.title')}</h1>

			<Card>
				<CardHeader>
					<CardTitle>{t('admin.tabs.title')}</CardTitle>
				</CardHeader>
				<CardContent>
					<nav className="flex space-x-1 border-b border-gray-200 mb-4">
						{tabs.map((tab) => (
							<NavLink
								key={tab.to}
								to={tab.to}
								className={({ isActive }) =>
									cn(
										'px-4 py-2 text-sm font-medium rounded-t-md transition-colors',
										'hover:bg-gray-100',
										isActive
											? 'bg-gray-100 text-gray-900 border-b-2 border-primary'
											: 'text-gray-500'
									)
								}
							>
								{tab.label}
							</NavLink>
						))}
					</nav>
					<div className="mt-4">
						<Outlet />
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export function AdminIndex() {
	const { isAdmin } = useAuth();
	return <Navigate to={isAdmin() ? '/admin/users' : '/admin/leagues'} replace />;
}
