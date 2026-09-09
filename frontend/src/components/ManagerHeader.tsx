import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Menu, LogOut, Globe } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/components/utils';
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
	/**
	 * Ink for the header's own text and controls. Light suits the navy and the
	 * darker team colours; a light background — the admin gold — needs dark,
	 * where white would sit at 1.6:1.
	 */
	ink?: 'light' | 'dark';
}

export default function ManagerHeader({
	title,
	subtitle,
	backTo,
	color = '#003E7E',
	ink = 'light',
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

	const dark = ink === 'dark';
	const inkClass = dark ? 'text-[#252525]' : 'text-white';
	const hoverClass = dark ? 'hover:bg-black/10' : 'hover:bg-white/20';
	const subtitleClass = dark ? 'text-[#252525]/70' : 'opacity-80';

	const isRootPage = location.pathname === '/admin' ||
		location.pathname === '/admin/' ||
		location.pathname === '/team-management' ||
		location.pathname === '/team-management/' ||
		location.pathname === '/team-management/my-teams' ||
		location.pathname === '/season-management' ||
		location.pathname === '/season-management/' ||
		location.pathname === '/season-management/my-seasons';

	return (
		<div
			className={cn('sticky top-0 z-10 border-b shadow-md', inkClass)}
			style={{ backgroundColor: color }}
		>
			<div className="px-4 py-3">
				<div className="flex items-center gap-3">
					{!isRootPage && (
						<Button
							variant="ghost"
							size="sm"
							className={cn('-ml-2', inkClass, hoverClass)}
							onClick={handleBack}
						>
							<ArrowLeft className="size-5" />
						</Button>
					)}
					<div className="flex-1 min-w-0">
						<h1 className="text-lg font-bold truncate">{title}</h1>
						{subtitle && (
							<p className={cn('text-sm truncate', subtitleClass)}>{subtitle}</p>
						)}
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className={cn(inkClass, hoverClass)}
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
