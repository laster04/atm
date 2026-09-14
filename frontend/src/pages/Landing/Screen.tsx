import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarDays, Check, Trophy, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { gameApi } from '@/services/api';
import { formatDateShort, formatGameTime } from '@/utils/date';
import { GameStatus, type Game } from '@types';
import { PublicFooter, PublicHeader, TeamCrest } from '@/components/public';
import { heroImage } from '@/components/public/hero';

export default function LandingScreen() {
	const { user } = useAuth();
	const { t, i18n } = useTranslation();
	const [games, setGames] = useState<Game[]>([]);

	useDocumentTitle(['Amateur Team Manager']);

	// The strip under the hero is the one piece of live proof on the page: what
	// is being played right now, then what is next. An empty app shows neither.
	useEffect(() => {
		Promise.all([
			gameApi.getPublic({ scope: 'live', take: 3 }),
			gameApi.getPublic({ scope: 'upcoming', take: 3 }),
		])
			.then(([live, upcoming]) => setGames([...live.data.items, ...upcoming.data.items].slice(0, 3)))
			.catch((error) => console.error(error));
	}, []);

	const hero = heroImage();
	const anyLive = games.some((game) => game.status === GameStatus.IN_PROGRESS);

	return (
		<div className="flex min-h-screen flex-col bg-card">
			<div className="relative">
				<PublicHeader variant="overlay" />

				<section className="relative overflow-hidden bg-navy">
					<picture>
						<source media="(max-width: 640px)" srcSet={hero.srcSmall} />
						<img
							src={hero.src}
							alt=""
							aria-hidden
							className="absolute inset-0 size-full object-cover"
							style={{ objectPosition: '55% 55%' }}
						/>
					</picture>
					<div
						className="absolute inset-0"
						style={{
							background:
								'linear-gradient(100deg, rgba(15,23,42,0.96) 0%, rgba(15,23,42,0.88) 40%, rgba(15,23,42,0.35) 78%, rgba(15,23,42,0.12) 100%)',
						}}
					/>
					<div className="relative mx-auto flex max-w-[1600px] flex-col gap-5 px-4 pb-20 pt-32 sm:px-8 sm:pb-24 sm:pt-40">
						<span className="flex items-center gap-2.5 self-start rounded-full border border-brand/40 bg-brand/15 px-3.5 py-1.5">
							<span className="size-1.5 rounded-full bg-brand" />
							<span className="text-xs font-semibold tracking-wide text-brand">{t('public.hero.kicker')}</span>
						</span>

						<h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-[56px]">
							{t('landing.hero.title').split('\n').map((line, index) => (
								<span key={index} className="block">{line}</span>
							))}
						</h1>

						<p className="max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
							{t('landing.hero.subtitle')}
						</p>

						<div className="mt-2 flex flex-wrap items-center gap-3">
							{user ? (
								<Link
									to="/dashboard"
									className="flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
								>
									{t('landing.hero.ctaDashboard')}
									<ArrowRight className="size-4.5" />
								</Link>
							) : (
								<Link
									to="/register"
									className="flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
								>
									{t('landing.hero.ctaStarted')}
									<ArrowRight className="size-4.5" />
								</Link>
							)}
							<Link
								to="/seasons"
								className="flex h-12 items-center rounded-xl border border-white/40 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
							>
								{t('public.landing.browse')}
							</Link>
						</div>
					</div>
				</section>
			</div>

			{/* TODAY STRIP */}
			{games.length > 0 && (
				<div className="relative z-10 mx-auto -mt-12 w-full max-w-[1600px] px-4 sm:px-8">
					<div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
						<div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
							{anyLive && <span className="size-2 animate-pulse rounded-full bg-destructive" />}
							<h2 className="text-[15px] font-bold">
								{t(anyLive ? 'public.landing.todayTitle' : 'public.landing.nextTitle')}
							</h2>
							<Link to="/games" className="ml-auto text-[13px] font-semibold text-primary hover:opacity-90">
								{t('public.landing.allGames')}
							</Link>
						</div>
						{/* Two games must not leave an empty third cell with a divider
						    hanging off it, so the row is only as wide as it has games —
						    and it still stacks on a phone. */}
						<div
							className={`grid divide-y divide-border-subtle sm:divide-x sm:divide-y-0 ${
								games.length >= 3 ? 'sm:grid-cols-3' : games.length === 2 ? 'sm:grid-cols-2' : ''
							}`}
						>
							{games.map((game) => {
								const live = game.status === GameStatus.IN_PROGRESS;
								return (
									<Link
										key={game.id}
										to={`/season-detail/${game.seasonId}?tab=schedule`}
										className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/50"
									>
										<div className="flex w-16 shrink-0 flex-col">
											{live ? (
												<span className="text-xs font-bold text-destructive-strong">
													{t('public.games.status.IN_PROGRESS')}
												</span>
											) : (
												<span className="text-xs font-bold">
													{game.date ? formatGameTime(game.date, i18n.language) : t('public.games.noTime')}
												</span>
											)}
											<span className="text-[11px] text-muted-foreground">
												{game.date ? formatDateShort(game.date, i18n.language) : ''}
											</span>
										</div>
										<div className="flex min-w-0 flex-1 items-center gap-2">
											{game.homeTeam && <TeamCrest team={game.homeTeam} size={26} />}
											<span className="truncate text-[13px] font-semibold">{game.homeTeam?.name}</span>
										</div>
										<span className="shrink-0 text-sm font-extrabold tabular-nums">
											{live || game.status === GameStatus.COMPLETED
												? `${game.homeScore ?? 0} : ${game.awayScore ?? 0}`
												: t('common.vs')}
										</span>
										<div className="flex min-w-0 flex-1 items-center justify-end gap-2">
											<span className="truncate text-[13px] font-semibold">{game.awayTeam?.name}</span>
											{game.awayTeam && <TeamCrest team={game.awayTeam} size={26} />}
										</div>
									</Link>
								);
							})}
						</div>
					</div>
				</div>
			)}

			{/* ENTRY POINTS */}
			<section className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-14 sm:px-8">
				<div className="flex flex-wrap items-baseline gap-3">
					<h2 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">
						{t('public.landing.exploreTitle')}
					</h2>
					<p className="text-[15px] text-subtle-foreground">{t('public.landing.exploreSubtitle')}</p>
				</div>

				<div className="grid gap-5 md:grid-cols-3">
					<Link
						to="/seasons"
						className="group relative flex min-h-48 flex-col gap-3 overflow-hidden rounded-2xl bg-navy p-6 text-white"
					>
						<span aria-hidden className="absolute -bottom-8 -right-8 size-40 rounded-full bg-primary/35" />
						<CalendarDays className="relative size-6 text-brand" />
						<h3 className="relative text-xl font-bold">{t('public.landing.cards.seasons.title')}</h3>
						<p className="relative flex-1 text-sm leading-relaxed text-white/70">
							{t('public.landing.cards.seasons.text')}
						</p>
						<span className="relative flex items-center gap-1.5 text-sm font-semibold text-brand">
							{t('public.landing.cards.seasons.action')}
							<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
						</span>
					</Link>

					<Link
						to="/tournaments"
						className="group flex min-h-48 flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
					>
						<Trophy className="size-6 text-primary" />
						<h3 className="text-xl font-bold">{t('public.landing.cards.tournaments.title')}</h3>
						<p className="flex-1 text-sm leading-relaxed text-subtle-foreground">
							{t('public.landing.cards.tournaments.text')}
						</p>
						<span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
							{t('public.landing.cards.tournaments.action')}
							<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
						</span>
					</Link>

					<Link
						to="/teams"
						className="group flex min-h-48 flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
					>
						<Users className="size-6 text-primary" />
						<h3 className="text-xl font-bold">{t('public.landing.cards.teams.title')}</h3>
						<p className="flex-1 text-sm leading-relaxed text-subtle-foreground">
							{t('public.landing.cards.teams.text')}
						</p>
						<span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
							{t('public.landing.cards.teams.action')}
							<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
						</span>
					</Link>
				</div>
			</section>

			{/* FOR ORGANISERS */}
			<section className="border-y border-border bg-background">
				<div className="mx-auto grid max-w-[1600px] items-center gap-10 px-4 py-14 sm:px-8 lg:grid-cols-2 lg:gap-16">
					<div className="flex flex-col gap-4">
						<span className="text-xs font-bold uppercase tracking-[0.08em] text-primary">
							{t('public.landing.organisers.kicker')}
						</span>
						<h2 className="text-[28px] font-extrabold leading-tight tracking-tight sm:text-[34px]">
							{t('public.landing.organisers.title')}
						</h2>
						<p className="text-[15px] leading-relaxed text-subtle-foreground">
							{t('public.landing.organisers.text')}
						</p>
						<ul className="mt-1 flex flex-col gap-3">
							{['schedule', 'liveTable', 'playerStats'].map((key) => (
								<li key={key} className="flex items-center gap-3">
									<span className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-success-soft">
										<Check className="size-3.5 text-success-strong" strokeWidth={3} />
									</span>
									<span className="text-sm">{t(`public.landing.organisers.points.${key}`)}</span>
								</li>
							))}
						</ul>
						<div className="mt-3 flex flex-wrap items-center gap-3">
							<Link
								to="/register"
								className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
							>
								{t('public.landing.organisers.cta')}
								<ArrowRight className="size-4" />
							</Link>
							<Link
								to="/about"
								className="flex h-11 items-center rounded-xl border border-border bg-card px-5 text-sm font-semibold transition-colors hover:bg-muted"
							>
								{t('public.landing.organisers.secondary')}
							</Link>
						</div>
					</div>

					<div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
						<div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
							<span className="size-2.5 rounded-full bg-border" />
							<span className="size-2.5 rounded-full bg-border" />
							<span className="size-2.5 rounded-full bg-border" />
							<span className="ml-2 flex h-6 flex-1 items-center rounded-md border border-border bg-card px-2.5 text-[11px] text-muted-foreground">
								{t('public.landing.organisers.previewUrl')}
							</span>
						</div>
						<div className="flex flex-col gap-3 p-5">
							<h3 className="text-base font-bold">{t('public.landing.organisers.previewTitle')}</h3>
							<div className="flex flex-col gap-1.5">
								{[
									{ name: 'SK Kámen', color: '#0F5132', record: '6 · 6 · 0', points: 18 },
									{ name: 'Pilaři', color: '#166534', record: '6 · 4 · 1', points: 13 },
									{ name: 'Jiskra Třeboň', color: '#0369A1', record: '6 · 3 · 1', points: 10 },
									{ name: 'HC Roso', color: '#B91C1C', record: '6 · 2 · 1', points: 7 },
								].map((row, index) => (
									<div
										key={row.name}
										className="flex items-center gap-3 rounded-lg px-3 py-2.5"
										style={{ backgroundColor: `${row.color}0d`, borderLeft: `3px solid ${row.color}` }}
									>
										<span className="w-4 text-xs font-bold">{index + 1}</span>
										<span className="flex-1 truncate text-[13px] font-semibold">{row.name}</span>
										<span className="text-xs text-muted-foreground">{row.record}</span>
										<span className="w-7 text-right text-[13px] font-extrabold">{row.points}</span>
									</div>
								))}
							</div>
							<p className="text-[11px] text-muted-foreground">{t('public.landing.organisers.previewNote')}</p>
						</div>
					</div>
				</div>
			</section>

			{/* TOURNAMENT CTA */}
			<section className="mx-auto w-full max-w-[1600px] px-4 py-14 sm:px-8">
				<div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl bg-navy px-6 py-10 sm:px-12 lg:flex-row lg:items-center">
					<span aria-hidden className="absolute -right-16 -top-16 size-72 rounded-full bg-brand/10" />
					<div className="relative flex flex-1 flex-col gap-2.5">
						<h2 className="text-[26px] font-extrabold tracking-tight text-white sm:text-3xl">
							{t('landing.tournamentCta.title')}
						</h2>
						<p className="max-w-2xl text-[15px] leading-relaxed text-white/70">
							{t('landing.tournamentCta.description')}
						</p>
					</div>
					<div className="relative flex flex-wrap items-center gap-3">
						<Link
							to="/tournaments"
							className="flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold text-brand-ink transition-opacity hover:opacity-90"
						>
							{t('landing.tournamentCta.explore')}
							<ArrowRight className="size-4" />
						</Link>
						{!user && (
							<Link
								to="/register?role=TOURNAMENT_MANAGER"
								className="flex h-12 items-center rounded-xl border border-white/35 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
							>
								{t('landing.tournamentCta.register')}
							</Link>
						)}
					</div>
				</div>
			</section>

			<PublicFooter />
		</div>
	);
}
