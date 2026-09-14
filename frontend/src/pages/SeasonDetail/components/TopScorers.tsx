import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TopScorer } from '@types';

/** Gold, silver, bronze for the first three; the rest take the quiet chip. */
const MEDALS = ['bg-brand text-brand-ink', 'bg-border text-subtle-foreground', 'bg-warning-soft text-warning-strong'];

interface TopScorersProps {
	topScorers: TopScorer[];
	loading?: boolean;
}

export default function TopScorers({ topScorers, loading }: TopScorersProps) {
	const { t } = useTranslation();

	if (loading) {
		return <div className="px-5 py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</div>;
	}

	if (topScorers.length === 0) {
		return (
			<div className="px-5 py-10 text-center text-sm text-muted-foreground">
				{t('seasonDetail.overview.noTopScorers')}
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			{topScorers.map((scorer, index) => (
				<div
					key={scorer.player.id}
					className="flex items-center gap-3 border-b border-border-subtle px-5 py-3 last:border-0"
				>
					<span
						className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
							MEDALS[index] ?? 'bg-muted text-subtle-foreground'
						}`}
					>
						{index + 1}
					</span>
					<div className="flex min-w-0 flex-col">
						<Link to={`/players/${scorer.player.id}`} className="truncate text-sm font-semibold hover:text-primary">
							{scorer.player.name}
						</Link>
						<span className="truncate text-xs text-muted-foreground">
							{scorer.player.team?.name}
							{scorer.player.number ? ` · #${scorer.player.number}` : ''}
						</span>
					</div>
					<div className="ml-auto flex items-baseline gap-1">
						<span className="text-[18px] font-extrabold">{scorer.points}</span>
						<span className="text-[11px] text-muted-foreground">
							{t('seasonDetail.overview.pointsShort')}
						</span>
					</div>
				</div>
			))}
		</div>
	);
}
