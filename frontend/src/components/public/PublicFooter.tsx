import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logoImage from '@/assets/logo-full.png';

const COLUMNS = [
	{
		key: 'public.footer.competitions',
		links: [
			{ to: '/leagues', key: 'public.nav.leagues' },
			{ to: '/seasons', key: 'public.nav.seasons' },
			{ to: '/tournaments', key: 'public.nav.tournaments' },
		],
	},
	{
		key: 'public.footer.statistics',
		links: [
			{ to: '/stats', key: 'public.nav.stats' },
			{ to: '/players', key: 'public.nav.players' },
			{ to: '/teams', key: 'public.nav.teams' },
		],
	},
	{
		key: 'public.footer.project',
		links: [
			{ to: '/about', key: 'public.nav.about' },
			{ to: '/games', key: 'public.nav.games' },
			{ to: '/docs', key: 'public.nav.docs' },
			{ to: '/updates', key: 'public.nav.updates' },
			{ to: '/contact', key: 'public.nav.contact' },
		],
	},
];

export default function PublicFooter() {
	const { t, i18n } = useTranslation();

	return (
		<footer className="bg-navy text-white">
			<div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
				<div className="flex flex-col gap-8 sm:flex-row sm:gap-16">
					<div className="flex max-w-sm flex-col gap-3">
						{/* The mark is drawn for light surfaces; on navy it is flattened to white
					    rather than sat in a white chip. */}
					<img
						src={logoImage}
						alt="ATM"
						className="h-9 w-auto self-start"
						style={{ filter: 'brightness(0) invert(1)' }}
					/>
						<p className="text-[13px] leading-relaxed text-white/60">{t('public.footer.blurb')}</p>
					</div>
					{COLUMNS.map((column) => (
						<div key={column.key} className="flex flex-col gap-2.5">
							<div className="text-[11px] font-bold uppercase tracking-wider text-white/45">
								{t(column.key)}
							</div>
							{column.links.map((link) => (
								<Link key={link.to} to={link.to} className="text-[13px] text-white/80 hover:text-white">
									{t(link.key)}
								</Link>
							))}
						</div>
					))}
				</div>
				<div className="flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center">
					<span className="flex-1">© {new Date().getFullYear()} {t('landing.footer')}</span>
					<button
						type="button"
						onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'cs' : 'en')}
						className="self-start hover:text-white/80"
					>
						{i18n.language === 'en' ? t('language.cs') : t('language.en')}
					</button>
				</div>
			</div>
		</footer>
	);
}
