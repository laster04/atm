import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from "@components/base/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from "./base/dropdown-menu";

import logoImage from '../assets/logo-full.png';

export default function Navbar() {
	// const { user, logout, isAdmin, isSeasonManager, isTeamManager } = useAuth();
	const { t, i18n } = useTranslation();

	const toggleLanguage = () => {
		const newLang = i18n.language === 'en' ? 'cs' : 'en';
		i18n.changeLanguage(newLang);
	};

	return (
		<>
			<header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
				<div className="container mx-auto px-4 py-6">
					<div className="flex items-center justify-between">

						<Link to="/">
						<div className="flex items-center gap-4">
							<img src={logoImage} alt="ATM - Amateur Team Manager" className="h-10" />
							<div className="hidden sm:block border-l pl-4">
								<h1 className="text-sm sm:text-xl font-medium ">
									Okresní přebor JH
								</h1>
								<p className="text-xs text-muted-foreground">
									2025 - 2026
								</p>
							</div>
						</div>
						</Link>
						<div className="flex items-center justify-end gap-8">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" className="flex items-center gap-2">
										<div className="sm:block text-left">
											<div className="text-sm font-medium">MENU</div>
										</div>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-56">
									<DropdownMenuItem>
										<Link to="/seasons" >
											{t('nav.seasons')}
										</Link>
									</DropdownMenuItem>
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
