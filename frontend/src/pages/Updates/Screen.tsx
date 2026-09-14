import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { FilterTabs, PublicHero } from '@/components/public';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getLocale } from '@/utils/date';
import {
	RELEASES,
	ROADMAP,
	hasUnreadUpdates,
	updatesLocale,
	type RoadmapStatus,
	type UpdatesArea,
} from '@/content/updates';

type View = 'released' | 'roadmap';
type AreaFilter = 'all' | UpdatesArea;

const AREAS: UpdatesArea[] = ['league', 'team', 'tournaments', 'public', 'fixes'];
const STATUSES: { status: RoadmapStatus; dot: string }[] = [
	{ status: 'IN_DEVELOPMENT', dot: 'rgb(var(--primary))' },
	{ status: 'DESIGNING', dot: 'rgb(var(--warning))' },
	{ status: 'CONSIDERING', dot: 'rgb(var(--muted-foreground))' },
];

export default function UpdatesScreen() {
	const { t, i18n } = useTranslation();
	const { user, markUpdatesSeen } = useAuth();
	const location = useLocation();
	const navigate = useNavigate();
	const [area, setArea] = useState<AreaFilter>('all');

	const view: View = location.pathname.endsWith('/roadmap') ? 'roadmap' : 'released';
	const locale = updatesLocale(i18n.language);

	useDocumentTitle([view === 'roadmap' ? t('public.updates.roadmap') : t('public.updates.released'), t('public.updates.title')]);

	// Opening the page reads everything released so far.
	useEffect(() => {
		if (user && hasUnreadUpdates(user.updatesSeenAt)) {
			markUpdatesSeen().catch((error) => console.error(error));
		}
	}, [user, markUpdatesSeen]);

	const releases = useMemo(
		() => RELEASES.filter((release) => area === 'all' || release.areas.includes(area)),
		[area],
	);
	const usedAreas = AREAS.filter((candidate) => RELEASES.some((release) => release.areas.includes(candidate)));

	const formatDate = (day: string) =>
		new Date(`${day}T00:00:00Z`).toLocaleDateString(getLocale(i18n.language), {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC',
		});

	return (
		<>
			<PublicHero
				title={t('public.updates.title')}
				subtitle={t('public.updates.subtitle')}
				crumbs={[
					{ label: t('public.nav.home'), to: '/' },
					{ label: t('public.updates.title'), to: view === 'roadmap' ? '/updates' : undefined },
					...(view === 'roadmap' ? [{ label: t('public.updates.roadmap') }] : []),
				]}
			/>

			<div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
					<FilterTabs<View>
						tabs={[
							{ value: 'released', label: t('public.updates.released') },
							{ value: 'roadmap', label: t('public.updates.roadmap') },
						]}
						value={view}
						onChange={(next) => navigate(next === 'roadmap' ? '/updates/roadmap' : '/updates')}
						className="self-start"
					/>

					{view === 'released' && (
						<div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:ml-auto lg:px-0">
							{(['all', ...usedAreas] as AreaFilter[]).map((option) => (
								<button
									key={option}
									type="button"
									aria-pressed={area === option}
									onClick={() => setArea(option)}
									className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] transition-colors ${
										area === option
											? 'bg-navy font-semibold text-white'
											: 'border border-border bg-card font-medium text-subtle-foreground hover:bg-muted'
									}`}
								>
									{t(`public.updates.areas.${option}`)}
								</button>
							))}
						</div>
					)}
				</div>

				{view === 'released' ? (
					<div className="flex flex-col gap-4">
						{releases.map((release) => {
							const content = release.content[locale];
							return (
								<article
									key={release.slug}
									className="grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8 sm:p-8"
								>
									<div className="flex flex-col gap-0.5">
										<time dateTime={release.releasedAt} className="text-[15px] font-bold">
											{formatDate(release.releasedAt)}
										</time>
										<span className="text-[13px] text-muted-foreground">{t('public.updates.releasedLabel')}</span>
									</div>
									<div className="flex flex-col gap-3.5">
										<h2 className="text-[22px] font-extrabold leading-tight tracking-tight">{content.title}</h2>
										<p className="text-[15px] leading-relaxed text-subtle-foreground">{content.summary}</p>
										<ul className="flex flex-col gap-2">
											{content.items.map((item) => (
												<li key={item} className="flex gap-2.5 text-[15px] leading-relaxed">
													<Check className="mt-1 size-4 shrink-0 text-success-strong" aria-hidden />
													<span>{item}</span>
												</li>
											))}
										</ul>
										<div className="flex flex-wrap gap-2">
											{release.areas.map((tag) => (
												<span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-subtle-foreground">
													{t(`public.updates.areas.${tag}`)}
												</span>
											))}
										</div>
									</div>
								</article>
							);
						})}
					</div>
				) : (
					<div className="flex flex-col gap-5">
						<div className="grid gap-5 md:grid-cols-3">
							{STATUSES.map(({ status, dot }) => {
								const items = ROADMAP.filter((item) => item.status === status);
								return (
									<section key={status} className="flex flex-col gap-3">
										<div className="flex items-center gap-2">
											<span className="size-2.5 rounded-full" style={{ backgroundColor: dot }} aria-hidden />
											<h2 className="text-base font-bold">{t(`public.updates.status.${status}`)}</h2>
											<span className="text-[13px] text-muted-foreground">{items.length}</span>
										</div>
										<p className="text-[13px] leading-snug text-muted-foreground">{t(`public.updates.statusHint.${status}`)}</p>
										{items.map((item) => (
											<div key={item.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
												<div className="text-[15px] font-bold">{item.content[locale].title}</div>
												<p className="text-sm leading-relaxed text-subtle-foreground">{item.content[locale].summary}</p>
												<div className="flex flex-wrap gap-1.5">
													{item.areas.map((tag) => (
														<span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-subtle-foreground">
															{t(`public.updates.areas.${tag}`)}
														</span>
													))}
												</div>
											</div>
										))}
									</section>
								);
							})}
						</div>
						<p className="text-[13px] text-muted-foreground">{t('public.updates.roadmapNote')}</p>
					</div>
				)}
			</div>
		</>
	);
}
