import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import ManagerHeader from '@/components/ManagerHeader';

export default function SeasonManagerLayout() {
	const { isAdmin, isSeasonManager } = useAuth();
	const { t } = useTranslation();
	const location = useLocation();

	if (!isAdmin() && !isSeasonManager()) {
		return (
			<div className="max-w-7xl mx-auto px-4 py-8 text-center">
				<h1 className="text-2xl font-bold text-red-600">{t('seasonManagement.accessDenied')}</h1>
				<p className="text-gray-600 mt-2">{t('seasonManagement.noPrivileges')}</p>
			</div>
		);
	}

	// The season detail screen carries its own header, tabs and bottom nav.
	const isDetailPage = /^\/season-management\/(?!my-seasons$)[^/]+$/.test(location.pathname);

	return (
		<div className="min-h-screen bg-background">
			{!isDetailPage && (
				<ManagerHeader
					title={t('seasonManagement.title')}
					subtitle={t('seasonManagement.subtitle')}
					backTo="/"
				/>
			)}
			<div className={isDetailPage ? '' : 'container mx-auto px-4 py-4'}>
				<Outlet />
			</div>
		</div>
	);
}

export function SeasonManagerIndex() {
	return <Navigate to="/season-management/my-seasons" replace />;
}
