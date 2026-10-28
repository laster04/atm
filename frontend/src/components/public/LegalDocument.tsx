import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import PublicHero from './PublicHero';

type Section = {
	title: string;
	paragraphs?: string[];
	items?: string[];
	after?: string;
};

/**
 * A legal text (privacy policy, terms of service) kept in the locale files as
 * `<ns>.title`, `subtitle`, `updated` and numbered `sections`, so every
 * language gets the same page.
 */
export default function LegalDocument({ ns }: { ns: 'privacy' | 'terms' }) {
	const { t } = useTranslation();
	useDocumentTitle([t(`${ns}.title`)]);

	const sections = t(`${ns}.sections`, { returnObjects: true }) as Section[];

	return (
		<>
			<PublicHero
				kicker={t('public.hero.kicker')}
				title={t(`${ns}.title`)}
				subtitle={t(`${ns}.subtitle`)}
				crumbs={[{ label: t('public.nav.home'), to: '/' }, { label: t(`${ns}.title`) }]}
			/>

			<div className="mx-auto flex max-w-[800px] flex-col gap-8 px-4 py-10 sm:px-8">
				<p className="text-sm text-muted-foreground">{t(`${ns}.updated`)}</p>

				{sections.map((section, index) => (
					<section key={section.title} className="flex flex-col gap-3">
						<h2 className="text-xl font-extrabold">
							{index + 1}. {section.title}
						</h2>
						{section.paragraphs?.map((paragraph) => (
							<p key={paragraph} className="text-[15px] leading-relaxed">{paragraph}</p>
						))}
						{section.items && (
							<ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed">
								{section.items.map((item) => <li key={item}>{item}</li>)}
							</ul>
						)}
						{section.after && <p className="text-[15px] leading-relaxed">{section.after}</p>}
					</section>
				))}

				<Link
					to="/contact"
					className="flex h-11 items-center self-start rounded-xl bg-navy px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
				>
					{t('public.nav.contact')}
				</Link>
			</div>
		</>
	);
}
