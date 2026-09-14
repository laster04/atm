import { AlertTriangle, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DocsBlock } from '@/content/docs';
import RichText from './RichText';

export default function ArticleBody({ blocks }: { blocks: DocsBlock[] }) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col gap-4 text-[15px] leading-relaxed text-subtle-foreground">
			{blocks.map((block, index) => {
				switch (block.type) {
					case 'h':
						return (
							<h3
								key={index}
								id={block.id}
								className="mt-4 scroll-mt-24 text-xl font-bold leading-7 text-foreground first:mt-0"
							>
								{block.text}
							</h3>
						);
					case 'p':
						return (
							<p key={index}>
								<RichText text={block.text} />
							</p>
						);
					case 'list':
						return (
							<ul key={index} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground">
								{block.items.map((item, i) => (
									<li key={i}>
										<RichText text={item} />
									</li>
								))}
							</ul>
						);
					case 'steps':
						return (
							<ol key={index} className="flex flex-col gap-3">
								{block.items.map((item, i) => (
									<li key={i} className="flex gap-3.5">
										<span
											aria-hidden
											className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-accent-foreground"
										>
											{i + 1}
										</span>
										<span className="pt-0.5">
											<RichText text={item} />
										</span>
									</li>
								))}
							</ol>
						);
					case 'defs':
						return (
							<dl key={index} className="flex flex-col">
								{block.items.map(([term, text], i) => (
									<div
										key={i}
										className="grid gap-1 border-t border-border-subtle py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4"
									>
										<dt className="text-sm font-bold text-foreground">
											<RichText text={term} />
										</dt>
										<dd>
											<RichText text={text} />
										</dd>
									</div>
								))}
							</dl>
						);
					case 'note': {
						const important = block.tone === 'important';
						return (
							<div
								key={index}
								role="note"
								className={`flex gap-3 rounded-xl p-4 ${important ? 'bg-warning-soft' : 'bg-accent'}`}
							>
								{important ? (
									<AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-strong" aria-hidden />
								) : (
									<Lightbulb className="mt-0.5 size-5 shrink-0 text-accent-foreground" aria-hidden />
								)}
								<div className="flex flex-col gap-1">
									<div className={`text-sm font-bold ${important ? 'text-warning-strong' : 'text-accent-foreground'}`}>
										{important ? t('public.docs.noteImportant') : t('public.docs.noteTip')}
									</div>
									<p className="text-foreground">
										<RichText text={block.text} />
									</p>
								</div>
							</div>
						);
					}
				}
			})}
		</div>
	);
}
