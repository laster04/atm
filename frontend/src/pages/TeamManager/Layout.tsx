import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@components/base/card';
import { cn } from '@/components/utils';

export default function TeamManagerLayout() {
	const { isTeamManager } = useAuth();
	const { t } = useTranslation();

	if (!isTeamManager()) {
		return (
			<div className="max-w-7xl mx-auto px-4 py-8 text-center">
				<h1 className="text-2xl font-bold text-red-600">{t('myTeams.accessDenied')}</h1>
				<p className="text-gray-600 mt-2">{t('myTeams.noPrivileges')}</p>
			</div>
		);
	}

	const tabs = [
		{ to: '/team-management/my-teams', label: t('teamManagement.tabs.myTeams') },
	];

	return (
		<div className="space-y-6">
			<h1 className="text-3xl font-bold mb-6">{t('teamManagement.title')}</h1>

			<Card>
				<CardHeader>
					<CardTitle>{t('teamManagement.tabs.title')}</CardTitle>
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

export function TeamManagerIndex() {
	return <Navigate to="/team-management/my-teams" replace />;
}
