import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, List } from 'lucide-react';
import { PublicHero, EmptyState } from '@/components/public';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { DEFAULT_SLUG, audiencesFor, docsLocale, findArticle, type DocsAudience } from '@/content/docs';
import { getLocale } from '@/utils/date';
import ArticleBody from './components/ArticleBody';
import DocsNav from './components/DocsNav';
import DocsSearch from './components/DocsSearch';

const AUDIENCE_KEY: Record<DocsAudience, string> = {
	ALL: 'public.docs.audience.ALL',
	LEAGUE: 'public.docs.audience.LEAGUE',
	TEAM: 'public.docs.audience.TEAM',
	TOURNAMENT: 'public.docs.audience.TOURNAMENT',
};

/** Sets the page's meta description for as long as the article is open. */
function useMetaDescription(content: string | undefined) {
	useEffect(() => {
		if (!content) return;
		let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
		const created = !tag;
		if (!tag) {
			tag = document.createElement('meta');
			tag.name = 'description';
			document.head.appendChild(tag);
		}
		const previous = tag.content;
		tag.content = content;
		return () => {
			if (created) tag?.remove();
			else if (tag) tag.content = previous;
		};
	}, [content]);
}

export default function DocsScreen() {
	const { slug = DEFAULT_SLUG } = useParams();
	const { t, i18n } = useTranslation();
	const { user, isAdmin } = useAuth();
	const [navOpen, setNavOpen] = useState(false);
	const headingRef = useRef<HTMLHeadingElement>(null);

	const locale = docsLocale(i18n.language);
	const article = findArticle(slug);
	const content = article?.content[locale];
	const audiences = user ? audiencesFor(user.manages, isAdmin()) : [];

	useDocumentTitle([content?.title, t('public.docs.title')]);
	useMetaDescription(content?.summary);

	// A new article starts at its top, and focus moves to its heading so a
	// screen reader announces the change.
	useEffect(() => {
		setNavOpen(false);
		if (window.location.hash) return;
		window.scrollTo({ top: 0 });
		headingRef.current?.focus({ preventScroll: true });
	}, [slug]);

	useEffect(() => {
		if (!navOpen) return;
		const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setNavOpen(false); };
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [navOpen]);

	const crumbs = [
		{ label: t('public.nav.home'), to: '/' },
		{ label: t('public.docs.title'), to: content ? '/docs' : undefined },
		...(content ? [{ label: content.title }] : []),
	];

	const updated = article
		? new Date(`${article.updatedAt}T00:00:00Z`).toLocaleDateString(getLocale(i18n.language), {
				day: 'numeric',
				month: 'numeric',
				year: 'numeric',
				timeZone: 'UTC',
			})
		: '';

	return (
		<>
			<PublicHero title={t('public.docs.title')} subtitle={t('public.docs.subtitle')} crumbs={crumbs} />

			<div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-10">
				<aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
					<DocsSearch />

					<button
						type="button"
						onClick={() => setNavOpen((open) => !open)}
						aria-expanded={navOpen}
						aria-controls="docs-nav"
						className="flex h-12 items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 text-left lg:hidden"
					>
						<List className="size-4 shrink-0 text-primary" aria-hidden />
						<span className="flex-1 text-[15px] font-semibold">{t('public.docs.contents')}</span>
						{article && (
							<span className="truncate text-[13px] text-muted-foreground">
								{t(`public.docs.categories.${article.category}`)}
							</span>
						)}
						<ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${navOpen ? 'rotate-180' : ''}`} aria-hidden />
					</button>

					<div id="docs-nav" className={`${navOpen ? 'block' : 'hidden'} rounded-xl border border-border bg-card p-2 lg:block lg:border-0 lg:bg-transparent lg:p-0`}>
						<DocsNav activeSlug={slug} audiences={audiences} onNavigate={() => setNavOpen(false)} />
					</div>
				</aside>

				<div className="flex min-w-0 max-w-[820px] flex-col gap-6">
					{!article || !content ? (
						<div className="flex flex-col items-center gap-4">
							<EmptyState title={t('public.docs.notFound')} />
							<Link to="/docs" className="text-sm font-semibold text-primary hover:underline">
								{t('public.docs.backToDocs')}
							</Link>
						</div>
					) : (
						<>
							<article className="flex flex-col gap-8 rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-10 sm:py-9">
								<header className="flex flex-col gap-3">
									<div className="flex flex-wrap items-center gap-2.5">
										{article.audiences.map((audience) => (
											<span key={audience} className="rounded-full bg-navy px-2.5 py-1 text-xs font-semibold text-white">
												{t(AUDIENCE_KEY[audience])}
											</span>
										))}
										<span className="text-[13px] text-muted-foreground">
											{t('public.docs.updated', { date: updated })}
										</span>
									</div>
									<h2
										ref={headingRef}
										tabIndex={-1}
										className="text-2xl font-extrabold leading-tight tracking-tight outline-none sm:text-[30px] sm:leading-[38px]"
									>
										{content.title}
									</h2>
									<p className="text-base leading-relaxed text-subtle-foreground sm:text-[17px]">{content.summary}</p>
								</header>

								<ArticleBody blocks={content.blocks} />
							</article>

							{article.related.length > 0 && (
								<section className="flex flex-col gap-3">
									<h2 className="text-[17px] font-bold">{t('public.docs.related')}</h2>
									<div className="grid gap-3 sm:grid-cols-3">
										{article.related
											.map((relatedSlug) => findArticle(relatedSlug))
											.filter((related) => related !== undefined)
											.map((related) => (
												<Link
													key={related.slug}
													to={`/docs/${related.slug}`}
													className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
												>
													<span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
														{t(`public.docs.categories.${related.category}`)}
													</span>
													<span className="text-[15px] font-bold text-primary">{related.content[locale].title}</span>
													<span className="text-[13px] leading-snug text-subtle-foreground">{related.content[locale].summary}</span>
												</Link>
											))}
									</div>
								</section>
							)}
						</>
					)}
				</div>
			</div>
		</>
	);
}
