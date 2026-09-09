import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import ManagerHeader from '@/components/ManagerHeader';

export default function TeamManagerLayout() {
	const { isTeamManager, isAdmin, isSeasonManager } = useAuth();
	const { t } = useTranslation();
	const location = useLocation();

	if (!isAdmin() && !isSeasonManager() && !isTeamManager()) {
		return (
			<div className="max-w-7xl mx-auto px-4 py-8 text-center">
				<h1 className="text-2xl font-bold text-red-600">{t('myTeams.accessDenied')}</h1>
				<p className="text-gray-600 mt-2">{t('myTeams.noPrivileges')}</p>
			</div>
		);
	}

	// Only the two list screens wear the shared header; everything below them
	// (a team, a game sheet) brings its own. Matching on the list paths keeps
	// this correct now that ids are UUIDs rather than numbers.
	const path = location.pathname.replace(/\/+$/, '');
	const isListPage = path === '/team-management' || path === '/team-management/my-teams';

	return (
		<div className="min-h-screen bg-background">
			{isListPage && (
				<ManagerHeader
					title={t('teamManagement.title')}
					subtitle={t('teamManagement.tabs.myTeams')}
					backTo="/"
				/>
			)}
			<div className={isListPage ? 'container mx-auto px-4 py-4' : ''}>
				<Outlet />
			</div>
		</div>
	);
}

export function TeamManagerIndex() {
	return <Navigate to="/team-management/my-teams" replace />;
}
