import { Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@components/base/card';
import ManagerHeader from '@/components/ManagerHeader';

export default function TournamentManagementLayout() {
  const { isAdmin, isTournamentManager, user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) return null;

  if (!isAdmin() && !isTournamentManager()) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">{t('tm.accessDenied')}</h1>
        <p className="text-gray-600 mt-2">{t('tm.noPrivileges')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ManagerHeader
        title={t('tm.title')}
        subtitle={user?.name}
        backTo="/"
        color="#7c3aed"
      />
      <div className="container mx-auto px-3 sm:px-4 py-4">
        <Card>
          <CardContent className="p-3 sm:p-6">
            <Outlet />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function TournamentManagementIndex() {
  return <Navigate to="/tournament-management/series" replace />;
}
