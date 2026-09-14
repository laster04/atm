import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { docsLocale, searchArticles } from '@/content/docs';

/**
 * Searches the help articles in the current language, locally. Styled like the
 * header's SearchBox; results open under the field and never leave the viewport.
 */
export default function DocsSearch() {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const [query, setQuery] = useState('');
	const [open, setOpen] = useState(false);
	const boxRef = useRef<HTMLDivElement>(null);
	const locale = docsLocale(i18n.language);

	const results = useMemo(() => searchArticles(query, locale, (key) => t(key)), [query, locale, t]);

	useEffect(() => {
		const onPointerDown = (event: MouseEvent) => {
			if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener('mousedown', onPointerDown);
		return () => document.removeEventListener('mousedown', onPointerDown);
	}, []);

	const go = (slug: string) => {
		setOpen(false);
		setQuery('');
		navigate(`/docs/${slug}`);
	};

	const clear = () => {
		setQuery('');
		setOpen(false);
	};

	return (
		<div ref={boxRef} className="relative">
			<div className="flex h-11 items-center gap-2.5 rounded-lg border border-border bg-card px-3.5">
				<Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
				<input
					type="text"
					enterKeyHint="search"
					value={query}
					onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
					onFocus={() => setOpen(true)}
					onKeyDown={(e) => { if (e.key === 'Escape') clear(); }}
					placeholder={t('public.docs.searchPlaceholder')}
					aria-label={t('public.docs.searchPlaceholder')}
					className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
				/>
				{query && (
					<button
						type="button"
						onClick={clear}
						aria-label={t('common.close')}
						className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
					>
						<X className="size-4" />
					</button>
				)}
			</div>

			{open && query.trim().length > 0 && (
				<div className="absolute left-0 right-0 top-[52px] z-30 max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-lg">
					{results.length === 0 ? (
						<div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
							<div className="text-sm font-semibold">{t('public.docs.noResults')}</div>
							<div className="text-sm text-muted-foreground">{t('public.docs.noResultsHint')}</div>
							<button
								type="button"
								onClick={() => go('rychly-start')}
								className="mt-1 text-sm font-semibold text-primary hover:underline"
							>
								{t('public.docs.showAll')}
							</button>
						</div>
					) : (
						<ul className="flex flex-col">
							{results.map(({ article, snippet }) => (
								<li key={article.slug}>
									<button
										type="button"
										onClick={() => go(article.slug)}
										className="flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left hover:bg-muted"
									>
										<span className="text-sm font-semibold">{article.content[locale].title}</span>
										<span className="text-xs text-muted-foreground">
											{t(`public.docs.categories.${article.category}`)}
										</span>
										<span className="line-clamp-2 text-[13px] text-subtle-foreground">{snippet}</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}
