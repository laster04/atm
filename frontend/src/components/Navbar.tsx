import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext.tsx';
import { Button } from "@components/base/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from "./base/dropdown-menu";
import { LogOut, UserCircle } from "lucide-react";
import { Badge } from "./base/badge";
import { Role } from "@types";
import logoImage from '../assets/logo-full.png';

export default function Navbar() {
	const { user, logout, isAdmin, isSeasonManager, isTeamManager, isTournamentManager } = useAuth();
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

	const getRoleBadgeVariant = (role: Role | undefined) => {
		switch (role) {
			case Role.ADMIN:
				return 'destructive' as const;
			case Role.SEASON_MANAGER:
				return 'default' as const;
			case Role.TEAM_MANAGER:
				return 'secondary' as const;
			case Role.TOURNAMENT_MANAGER:
				return 'secondary' as const;
			default:
				return 'outline' as const;
		}
	};

	return (
		<>
			<header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
				<div className="container mx-auto px-4 py-6">
					<div className="flex items-center justify-between">

						<Link to="/dashboard">
						<div className="flex items-center gap-4">
							<img src={logoImage} alt="ATM - Amateur Team Manager" className="h-10" />
							<div className="hidden sm:block border-l pl-4">
								<h1 className="text-sm sm:text-xl font-medium ">
									ATM - Amateur Team Manager
								</h1>
								<p className="text-xs text-muted-foreground">
									{t('nav.tagline')}
								</p>
							</div>
						</div>
						</Link>
						<div className="flex items-center justify-end gap-8">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" className="flex items-center gap-2">
										{user ? (
											<UserCircle className="size-5" />
										) : <></>}
										<div className="sm:block text-left">
											<div className="text-sm font-medium">{t('nav.menu')}</div>
											{user ? (
												<div className="text-xs text-muted-foreground">{user.name}</div>
											) : <></>}
										</div>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-56">
									{user ? (
										<>
											<DropdownMenuLabel>
												<div className="flex flex-col space-y-1">
													<p className="text-sm font-medium">{t('nav.loggedInAs')}</p>
													<Badge variant={getRoleBadgeVariant(user?.role)} className="w-fit">
														{user?.role ? t(`admin.roles.${user.role}`) : ''}
													</Badge>
												</div>
											</DropdownMenuLabel>
											<DropdownMenuSeparator />
										</>
									) : <></>}
									<DropdownMenuItem asChild>
										<Link to="/leagues">{t('nav.leagues')}</Link>
									</DropdownMenuItem>
									<DropdownMenuItem asChild>
										<Link to="/seasons">{t('nav.seasons')}</Link>
									</DropdownMenuItem>
									<DropdownMenuItem asChild>
										<Link to="/tournaments">Tournaments</Link>
									</DropdownMenuItem>
									<DropdownMenuSeparator />

									{user ? (
										<>
											{isTeamManager() && (
												<DropdownMenuItem asChild>
													<Link to="/team-management">{t('nav.myTeams')}</Link>
												</DropdownMenuItem>
											)}
											{(isTournamentManager() || isAdmin()) && (
												<DropdownMenuItem asChild>
													<Link to="/tournament-management">{t('nav.manageTournaments')}</Link>
												</DropdownMenuItem>
											)}
											{isSeasonManager() && (
												<DropdownMenuItem asChild>
													<Link to="/admin">{t('nav.mySeasons')}</Link>
												</DropdownMenuItem>
											)}
											{isAdmin() && (
												<DropdownMenuItem asChild>
													<Link to="/admin">{t('nav.admin')}</Link>
												</DropdownMenuItem>
											)}
											<DropdownMenuItem onClick={handleLogout}>
												<LogOut className="size-4 mr-2" />
												{t('nav.logout')}
											</DropdownMenuItem>
										</>
									) : (
										<DropdownMenuItem onClick={handleToLoginPage}>
											{t('nav.login')}
										</DropdownMenuItem>
									)}
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={toggleLanguage}>
										{i18n.language === 'en' ? t('language.cs') : t('language.en')}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				</div>
			</header>
		</>
	);
}
