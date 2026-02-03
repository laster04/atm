import { Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

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

	return <Outlet />;
}

export function TeamManagerIndex() {
	return <Navigate to="/team-management/my-teams" replace />;
}
