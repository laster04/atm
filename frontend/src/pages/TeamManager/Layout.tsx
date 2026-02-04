import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import ManagerHeader from '@/components/ManagerHeader';

export default function TeamManagerLayout() {
	const { isTeamManager } = useAuth();
	const { t } = useTranslation();
	const location = useLocation();

	if (!isTeamManager()) {
		return (
			<div className="max-w-7xl mx-auto px-4 py-8 text-center">
				<h1 className="text-2xl font-bold text-red-600">{t('myTeams.accessDenied')}</h1>
				<p className="text-gray-600 mt-2">{t('myTeams.noPrivileges')}</p>
			</div>
		);
	}

	// Don't show header on team detail page (it has its own header)
	const isTeamDetailPage = /^\/team-management\/\d+/.test(location.pathname);

	return (
		<div className="min-h-screen bg-background">
			{!isTeamDetailPage && (
				<ManagerHeader
					title={t('teamManagement.title')}
					subtitle={t('teamManagement.tabs.myTeams')}
					backTo="/"
				/>
			)}
			<div className={isTeamDetailPage ? '' : 'container mx-auto px-4 py-4'}>
				<Outlet />
			</div>
		</div>
	);
}

export function TeamManagerIndex() {
	return <Navigate to="/team-management/my-teams" replace />;
}
