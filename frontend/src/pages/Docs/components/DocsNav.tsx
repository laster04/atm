import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CATEGORIES, PUBLISHED, docsLocale, type DocsAudience, type DocsCategory } from '@/content/docs';

const CATEGORY_AUDIENCE: Partial<Record<DocsCategory, DocsAudience>> = {
	league: 'LEAGUE',
	team: 'TEAM',
	more: 'TOURNAMENT',
};

interface DocsNavProps {
	activeSlug: string;
	/** What the signed-in user manages; their categories come first. */
	audiences: DocsAudience[];
	onNavigate?: () => void;
}

export default function DocsNav({ activeSlug, audiences, onNavigate }: DocsNavProps) {
	const { t, i18n } = useTranslation();
	const locale = docsLocale(i18n.language);

	const recommended = (category: DocsCategory) => {
		const audience = CATEGORY_AUDIENCE[category];
		return !!audience && audiences.includes(audience);
	};
	// Getting started always leads; what the user manages follows it.
	const ordered = [...CATEGORIES].sort((a, b) => {
		if (a === 'start' || b === 'start') return a === 'start' ? -1 : 1;
		return Number(recommended(b)) - Number(recommended(a));
	});

	return (
		<nav aria-label={t('public.docs.navLabel')} className="flex flex-col gap-5">
			{ordered.map((category) => {
				const articles = PUBLISHED.filter((article) => article.category === category);
				if (articles.length === 0) return null;
				return (
					<div key={category} className="flex flex-col gap-0.5">
						<div className="flex items-center gap-2 px-3 pb-1.5">
							<span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
								{t(`public.docs.categories.${category}`)}
							</span>
							{recommended(category) && (
								<span className="rounded-full bg-brand px-1.5 py-px text-[10px] font-bold text-brand-ink">
									{t('public.docs.forYou')}
								</span>
							)}
						</div>
						{articles.map((article) => {
							const active = article.slug === activeSlug;
							return (
								<Link
									key={article.slug}
									to={`/docs/${article.slug}`}
									onClick={onNavigate}
									aria-current={active ? 'page' : undefined}
									className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm transition-colors ${
										active
											? 'bg-accent font-semibold text-accent-foreground'
											: 'font-medium text-subtle-foreground hover:bg-muted hover:text-foreground'
									}`}
								>
									{article.content[locale].title}
								</Link>
							);
						})}
					</div>
				);
			})}
		</nav>
	);
}
