import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PublicHero } from '@/components/public';
import ApplicationInfoSection from '@/pages/Home/components/ApplicationInfoSection';

export default function AboutScreen() {
	const { t } = useTranslation();
	useDocumentTitle([t('public.about.title')]);

	return (
		<>
			<PublicHero
				kicker={t('public.hero.kicker')}
				title={t('public.about.title')}
				subtitle={t('public.about.subtitle')}
				crumbs={[{ label: t('public.nav.home'), to: '/' }, { label: t('public.about.title') }]}
			/>

			<div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-4 py-10 sm:px-8">
				<ApplicationInfoSection />

				<div className="flex flex-col items-center gap-4 rounded-2xl bg-navy px-6 py-10 text-center">
					<h2 className="text-2xl font-extrabold text-white">{t('public.about.ctaTitle')}</h2>
					<p className="max-w-lg text-[15px] leading-relaxed text-white/70">{t('public.about.ctaText')}</p>
					<Link
						to="/register"
						className="flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink transition-opacity hover:opacity-90"
					>
						{t('landing.hero.ctaStarted')}
						<ArrowRight className="size-4" />
					</Link>
				</div>
			</div>
		</>
	);
}
