import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Trophy, Users } from 'lucide-react';
import { ADMIN_GOLD_INK } from '../components/util';

/**
 * What is left once per-season work moved to the season manager: the two views
 * that genuinely span seasons, plus one line telling anyone hunting for the old
 * Teams tab where that work went.
 */
export default function MorePage() {
	const { t } = useTranslation();

	const links = [
		{
			to: '/admin/players',
			icon: Users,
			title: t('admin.nav.players'),
			hint: t('admin.more.playersHint'),
		},
		{
			to: '/admin/games',
			icon: CalendarDays,
			title: t('admin.nav.games'),
			hint: t('admin.more.gamesHint'),
		},
	];

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-col gap-2">
				<span className="tm-section-label">{t('admin.more.acrossSeasons')}</span>
				<div className="tm-rows-card">
					{links.map((link) => (
						<Link key={link.to} to={link.to} className="flex items-center gap-3 px-3 py-3">
							<link.icon className="size-5 shrink-0" style={{ color: ADMIN_GOLD_INK }} aria-hidden />
							<span className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="text-[14.5px] font-semibold">{link.title}</span>
								<span className="text-xs text-muted-foreground">{link.hint}</span>
							</span>
							<ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
						</Link>
					))}
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<span className="tm-section-label">{t('admin.more.seasonWork')}</span>
				<div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5">
					<div className="flex items-start gap-3">
						<span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted">
							<Trophy className="size-[19px] text-muted-foreground" aria-hidden />
						</span>
						<span className="flex min-w-0 flex-1 flex-col gap-0.5">
							<span className="text-[14.5px] font-semibold leading-snug">
								{t('admin.more.seasonWorkTitle')}
							</span>
							<span className="text-[12.5px] leading-snug text-muted-foreground">
								{t('admin.more.seasonWorkHint')}
							</span>
						</span>
					</div>
					<Link
						to="/admin/seasons"
						className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-border text-sm font-semibold"
						style={{ color: ADMIN_GOLD_INK }}
					>
						{t('admin.more.openSeasons')}
						<ChevronRight className="size-4" aria-hidden />
					</Link>
				</div>
			</div>
		</div>
	);
}
