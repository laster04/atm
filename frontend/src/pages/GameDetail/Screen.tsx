import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { gameApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { profileFor } from '@/utils/sportProfiles';
import { EmptyState } from '@/components/public';
import type { GameDetail } from '@types';
import MatchHeader from './components/MatchHeader';
import Timeline from './components/Timeline';
import SetsPanel from './components/SetsPanel';
import PlayerLines from './components/PlayerLines';
import TableExcerpt from './components/TableExcerpt';
import Meetings from './components/Meetings';

/**
 * The public page of one game: what happened, who did it, and where it leaves
 * the table. Games of an archived season are gone (archiving keeps only the
 * final table), so they have no page.
 */
export default function GameDetailScreen() {
	const { id } = useParams<{ id: string }>();
	const { t } = useTranslation();
	const [detail, setDetail] = useState<GameDetail | null>(null);
	const [missing, setMissing] = useState(false);

	useEffect(() => {
		if (!id) return;
		setDetail(null);
		setMissing(false);
		gameApi.getDetail(id)
			.then((res) => setDetail(res.data))
			.catch(() => setMissing(true));
	}, [id]);

	const game = detail?.game;
	useDocumentTitle(game ? [`${game.homeTeam.name} – ${game.awayTeam.name}`, detail?.league.name] : [t('gameDetail.title')]);

	if (missing) {
		return (
			<div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-8">
				<EmptyState title={t('gameDetail.notFound')} />
			</div>
		);
	}
	if (!detail || !game) {
		return <div className="mx-auto max-w-[1240px] px-4 py-16 text-center text-muted-foreground sm:px-8">{t('gameDetail.loading')}</div>;
	}

	const profile = profileFor(detail.league.sportType);
	const played = game.status === 'COMPLETED' || game.status === 'IN_PROGRESS';
	const waiting = game.status === 'COMPLETED' && !game.confirmed;

	return (
		<>
			<MatchHeader detail={detail} profile={profile} />
			<div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-7 sm:px-8 lg:flex-row lg:items-start">
				<div className="flex min-w-0 flex-col gap-6 lg:flex-[2]">
					{waiting && (
						<p role="status" className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning-strong">
							<Info className="mt-0.5 size-4 shrink-0" aria-hidden />
							{t('gameDetail.waitingNote')}
						</p>
					)}
					{profile.scoreIsPartsWon && played && game.periodScores && game.periodScores.length > 0 && (
						<SetsPanel game={game} />
					)}
					{detail.events.length > 0 && <Timeline detail={detail} profile={profile} />}
					{detail.players.length > 0 && profile.stats.length > 0 && <PlayerLines detail={detail} profile={profile} />}
				</div>
				<aside className="flex min-w-0 flex-col gap-6 lg:flex-1">
					<TableExcerpt detail={detail} volleyball={profile.scoreIsPartsWon} />
					{detail.headToHead.length > 0 && <Meetings detail={detail} />}
				</aside>
			</div>
		</>
	);
}
