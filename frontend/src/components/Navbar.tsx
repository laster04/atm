import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, isAdmin, isSeasonManager, isTeamManager } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'cs' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="text-xl font-bold">
            {t('nav.brand')}
          </Link>

          <div className="flex items-center space-x-4">
            <Link to="/seasons" className="hover:text-blue-200">
              {t('nav.seasons')}
            </Link>

            {user ? (
              <>
                {isTeamManager() && (
                  <Link to="/my-teams" className="hover:text-blue-200">
                    {t('nav.myTeams')}
                  </Link>
                )}
                {isSeasonManager() && (
                  <Link to="/admin" className="hover:text-blue-200">
                    {t('nav.mySeasons')}
                  </Link>
                )}
                {isAdmin() && (
                  <Link to="/admin" className="hover:text-blue-200">
                    {t('nav.admin')}
                  </Link>
                )}
                <span className="text-blue-200">
                  {user.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded"
                >
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hover:text-blue-200"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded"
                >
                  {t('nav.register')}
                </Link>
              </>
            )}

            <button
              onClick={toggleLanguage}
              className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded text-sm font-medium"
            >
              {i18n.language === 'en' ? t('language.cs') : t('language.en')}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
