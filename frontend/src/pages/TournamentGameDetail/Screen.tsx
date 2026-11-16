import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { tournamentGameApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { profileFor } from '@/utils/sportProfiles';
import { formatDateShort, formatGameDateTime } from '@/utils/date';
import { EmptyState, Panel, TeamCrest, useLightChrome } from '@/components/public';
import MatchHeader from '@/components/match/MatchHeader';
import SetsPanel from '@/components/match/SetsPanel';
import ExtrasBand from '@/pages/TournamentDetail/components/ExtrasBand';
import GroupStandings from '@/pages/TournamentDetail/components/GroupStandings';
import type { TournamentGameDetail } from '@types';

/** The status chip of a tournament game; its result counts as soon as it is saved. */
const chipClass = (status: string): string =>
	status === 'IN_PROGRESS' ? 'bg-destructive-strong text-white'
		: status === 'COMPLETED' ? 'bg-success-soft text-success-strong'
			: 'bg-white/10 text-white';

/**
 * The public page of one tournament game: the result, the players who scored,
 * the group table or where the winner goes on, and the tournament's partners.
 * A Turnaj Plus tournament keeps its light shell here too.
 */
export default function TournamentGameDetailScreen() {
	const { id } = useParams<{ id: string }>();
	const { t, i18n } = useTranslation();
	const [detail, setDetail] = useState<TournamentGameDetail | null>(null);
	const [missing, setMissing] = useState(false);

	useEffect(() => {
		if (!id) return;
		setDetail(null);
		setMissing(false);
		tournamentGameApi.getDetail(id).then((res) => setDetail(res.data)).catch(() => setMissing(true));
	}, [id]);

	useLightChrome(detail?.branding === 'LIGHT');
	const game = detail?.game;
	useDocumentTitle(game ? [`${game.homeTeam?.name ?? '?'} – ${game.awayTeam?.name ?? '?'}`, detail?.tournament.name] : [t('gameDetail.title')]);

	if (missing) {
		return (
			<div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-8">
				<EmptyState title={t('tournamentGameDetail.notFound')} />
			</div>
		);
	}
	if (!detail || !game) {
		return <div className="mx-auto max-w-[1240px] px-4 py-16 text-center text-muted-foreground sm:px-8">{t('gameDetail.loading')}</div>;
	}

	const profile = profileFor(detail.series.sportType);
	const context = detail.series.sportType === 'TENNIS' ? 'TENNIS' as const : undefined;
	const tournamentPath = `/tournament/${detail.tournament.id}`;
	const light = detail.branding === 'LIGHT';
	const scored = game.homeScore != null && game.awayScore != null && game.status !== 'SCHEDULED';
	const stage = game.phase === 'GROUP'
		? t('tournamentGameDetail.group', { name: game.group?.name ?? '' })
		: t(`playoff.rounds.${game.phase}`);
	const tbd = { id: '', name: t('tm.common.tbd'), logo: null, primaryColor: null };
	const names = new Map([game.homeTeam, game.awayTeam].filter(Boolean).map((team) => [team!.id, team!.name]));
	const status = game.status === 'COMPLETED' ? 'played' : game.status.toLowerCase();

	return (
		<>
			<MatchHeader
				crumbs={[
					// A Turnaj Plus page leads back to its tournament, not into ATM.
					...(light ? [] : [{ label: detail.series.name, to: `/tournaments/${detail.series.id}` }]),
					{ label: detail.tournament.name, to: tournamentPath },
					{ label: stage },
				]}
				home={{ team: game.homeTeam ?? tbd }}
				away={{ team: game.awayTeam ?? tbd }}
				homeScore={game.homeScore}
				awayScore={game.awayScore}
				scored={scored}
				status={{ label: t(`gameDetail.status.${status}`), className: chipClass(game.status) }}
				date={game.date}
				location={game.location}
			/>
			<ExtrasBand tournament={{ id: detail.tournament.id, sponsors: detail.sponsors, documents: detail.documents }} />

			<div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-7 sm:px-8 lg:flex-row lg:items-start">
				<div className="flex min-w-0 flex-col gap-6 lg:flex-[2]">
					{profile.scoreIsPartsWon && scored && game.periodScores && game.periodScores.length > 0 && game.homeTeam && game.awayTeam && (
						<SetsPanel game={{ periodScores: game.periodScores, homeTeam: game.homeTeam, awayTeam: game.awayTeam }} />
					)}

					{detail.players.length > 0 && (
						<Panel flush title={t('gameDetail.players.title')}>
							<div className="grid sm:grid-cols-2">
								{[game.homeTeam, game.awayTeam].filter(Boolean).map((team) => {
									const lines = detail.players
										.filter((line) => line.teamId === team!.id)
										.sort((a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals);
									return (
										<div key={team!.id} className="min-w-0 border-border-subtle px-5 pb-4 pt-3 sm:odd:border-r">
											<h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold">
												<TeamCrest team={team!} size={20} />
												{team!.name}
											</h3>
											{lines.length === 0 ? (
												<p className="py-2 text-sm text-muted-foreground">{t('gameDetail.players.none')}</p>
											) : (
												<table className="w-full border-collapse text-sm tabular-nums">
													<thead>
														<tr className="text-[11.5px] font-semibold text-muted-foreground">
															<th scope="col" className="border-b border-border py-1.5 text-left">{t('gameDetail.players.player')}</th>
															<th scope="col" className="w-10 border-b border-border py-1.5 text-center"><abbr title={t('stats.long.goals')} className="no-underline">{t('stats.short.goals')}</abbr></th>
															<th scope="col" className="w-10 border-b border-border py-1.5 text-center"><abbr title={t('stats.long.assists')} className="no-underline">{t('stats.short.assists')}</abbr></th>
														</tr>
													</thead>
													<tbody>
														{lines.map((line) => (
															<tr key={line.player.id}>
																<th scope="row" className="border-b border-border-subtle py-2 text-left font-semibold">
																	<span className="inline-block w-7 font-normal text-muted-foreground">{line.player.number ?? ''}</span>
																	{line.player.name}
																</th>
																<td className="border-b border-border-subtle py-2 text-center">{line.goals}</td>
																<td className="border-b border-border-subtle py-2 text-center">{line.assists}</td>
															</tr>
														))}
													</tbody>
												</table>
											)}
										</div>
									);
								})}
							</div>
						</Panel>
					)}
				</div>

				<aside className="flex min-w-0 flex-col gap-6 lg:flex-1">
					{detail.table && detail.table.rows.length > 0 && (
						<Panel flush title={t('tournamentGameDetail.groupTable', { name: detail.table.group?.name ?? '' })}>
							<GroupStandings standings={detail.table.rows} qualified={new Set()} context={context} variant="compact" volleyball={profile.scoreIsPartsWon} />
							<p className="border-t border-border-subtle px-5 py-3 text-sm">
								<Link to={`${tournamentPath}?tab=groups`} className="font-semibold text-primary hover:underline">{t('tournamentGameDetail.allGroups')}</Link>
							</p>
						</Panel>
					)}

					{detail.next && (
						<Panel title={t('tournamentGameDetail.next.title')}>
							<div className="flex flex-col gap-3 text-sm">
								<p className="flex items-center gap-2 font-semibold">
									<ArrowRight className="size-4 text-primary" aria-hidden />
									{t('tournamentGameDetail.next.goesTo', { round: t(`playoff.rounds.${detail.next.phase}`).toLowerCase() })}
								</p>
								{detail.next.opponent ? (
									<p className="flex items-center gap-2">
										<TeamCrest team={detail.next.opponent} size={24} />
										{t('tournamentGameDetail.next.against', { team: detail.next.opponent.name })}
									</p>
								) : (
									<p className="text-muted-foreground">{t('tournamentGameDetail.next.opponentUnknown')}</p>
								)}
								{detail.next.date && <p className="text-muted-foreground">{formatGameDateTime(detail.next.date, i18n.language)}</p>}
								<Link to={`${tournamentPath}?tab=playoff`} className="font-semibold text-primary hover:underline">{t('tournamentGameDetail.next.bracket')}</Link>
							</div>
						</Panel>
					)}

					{detail.meetings.length > 0 && (
						<Panel flush title={t('tournamentGameDetail.meetings')}>
							<ul>
								{detail.meetings.map((meeting) => {
									const played = meeting.homeScore != null && meeting.awayScore != null && meeting.status !== 'SCHEDULED';
									return (
										<li key={meeting.id} className="border-t border-border-subtle first:border-0">
											<Link to={`/tournament/games/${meeting.id}`} className="flex min-h-[52px] items-center gap-3 px-5 py-2.5 hover:bg-muted/50">
												<span className="flex min-w-0 flex-1 flex-col gap-0.5">
													<span className="text-xs text-muted-foreground">
														{meeting.phase === 'GROUP' ? t('tournamentGameDetail.groupStage') : t(`playoff.rounds.${meeting.phase}`)}
														{meeting.date && ` · ${formatDateShort(meeting.date, i18n.language)}`}
													</span>
													<span className="truncate text-sm font-semibold">
														{names.get(meeting.homeTeamId ?? '')} – {names.get(meeting.awayTeamId ?? '')}
													</span>
												</span>
												<span className="shrink-0 text-base font-extrabold tabular-nums">
													{played ? `${meeting.homeScore}:${meeting.awayScore}` : t('gameDetail.meetings.upcoming')}
												</span>
											</Link>
										</li>
									);
								})}
							</ul>
						</Panel>
					)}
				</aside>
			</div>
		</>
	);
}
