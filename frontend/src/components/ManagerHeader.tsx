import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Menu, LogOut, Globe } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@components/base/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from './base/dropdown-menu';

interface ManagerHeaderProps {
	title: string;
	subtitle?: string;
	backTo?: string;
	color?: string;
}

export default function ManagerHeader({
	title,
	subtitle,
	backTo,
	color = '#003E7E',
}: ManagerHeaderProps) {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const { user, logout } = useAuth();

	const handleBack = () => {
		if (backTo) {
			navigate(backTo);
		} else {
			navigate(-1);
		}
	};

	const handleLogout = () => {
		logout();
		navigate('/');
	};

	const toggleLanguage = () => {
		const newLang = i18n.language === 'en' ? 'cs' : 'en';
		i18n.changeLanguage(newLang);
	};

	const isRootPage = location.pathname === '/admin' ||
		location.pathname === '/admin/' ||
		location.pathname === '/team-management' ||
		location.pathname === '/team-management/' ||
		location.pathname === '/team-management/my-teams';

	return (
		<div
			className="sticky top-0 z-10 text-white border-b shadow-md"
			style={{ backgroundColor: color }}
		>
			<div className="px-4 py-3">
				<div className="flex items-center gap-3">
					{!isRootPage && (
						<Button
							variant="ghost"
							size="sm"
							className="text-white hover:bg-white/20 -ml-2"
							onClick={handleBack}
						>
							<ArrowLeft className="size-5" />
						</Button>
					)}
					<div className="flex-1 min-w-0">
						<h1 className="text-lg font-bold truncate">{title}</h1>
						{subtitle && (
							<p className="text-sm opacity-80 truncate">{subtitle}</p>
						)}
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="text-white hover:bg-white/20"
							>
								<Menu className="size-5" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem asChild>
								<Link to="/">{t('nav.brand')}</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to="/seasons">{t('nav.seasons')}</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={toggleLanguage}>
								<Globe className="size-4 mr-2" />
								{i18n.language === 'en' ? t('language.cs') : t('language.en')}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							{user && (
								<DropdownMenuItem onClick={handleLogout}>
									<LogOut className="size-4 mr-2" />
									{t('nav.logout')}
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</div>
	);
}
