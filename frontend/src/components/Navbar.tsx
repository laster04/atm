import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from "@components/base/button";

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

	const handleToLoginPage = () => {
		navigate('/login');
	}

	return (
		<>
			<header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
				<div className="container mx-auto px-4 py-6">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div>
								<Link to="/">
									<h1 className="text-3xl font-medium">{t('nav.brand')}</h1>
									<p className="text-sm text-muted-foreground">
										Your central hub for all sports leagues and seasons
									</p>
								</Link>
							</div>
						</div>
						<div className="flex items-center justify-end gap-8">
							{user ? (
								<>
									{isTeamManager() && (
										<Link to="/my-teams" className="hover:text-blue-200">
											<Button variant="outline">
												{t('nav.myTeams')}
											</Button>
										</Link>
									)}
									{isSeasonManager() && (
										<Link to="/admin" className="hover:text-blue-200">
											<Button variant="outline">
												{t('nav.mySeasons')}
											</Button>
										</Link>
									)}
									{isAdmin() && (
										<Link to="/admin" className="hover:text-blue-200">
											<Button variant="outline">
												{t('nav.admin')}
											</Button>
										</Link>
									)}
									<span className="text-blue-200">
                        {user.name}
                      </span>

									<Button variant="outline" onClick={handleLogout}>
										{t('nav.logout')}
									</Button>
								</>
							) : (
								<Button variant="outline" onClick={handleToLoginPage}>
									{t('nav.login')}
								</Button>
							)}

							<Button
								variant="outline"
								onClick={toggleLanguage}
								className="rounded text-sm font-medium"
							>
								{i18n.language === 'en' ? t('language.cs') : t('language.en')}
							</Button>
						</div>
					</div>
				</div>
			</header>
		</>
	);
}
