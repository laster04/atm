import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Target, Trash2 } from 'lucide-react';

/** The scorer pages' own colour: the season and tournament manager navy. */
export const NAVY = '#0F172A';

type PlayerRef = { name: string; number?: number | null };

export const playerLabel = (player?: PlayerRef | null) =>
	player ? (player.number != null ? `#${player.number} ${player.name}` : player.name) : null;

/** The style of a chosen option button. */
export const chosen = (selected: boolean) =>
	selected ? { backgroundColor: NAVY, borderColor: NAVY, color: '#ffffff' } : undefined;

export const fieldClass = 'h-12 rounded-[10px] border border-border bg-input-background px-3 text-[15px]';

/** One goal in the list: who scored (and assisted), for which team, removable when the link wrote it. */
export function GoalRow({
	color,
	title,
	subtitle,
	onDelete,
	busy,
}: {
	color: string | null | undefined;
	title: string;
	subtitle: string;
	onDelete?: () => void;
	busy?: boolean;
}) {
	const { t } = useTranslation();
	return (
		<div className="flex items-center gap-3 px-3.5 py-2.5">
			<span
				className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
				style={{ backgroundColor: color || '#94a3b8' }}
			>
				<Target className="size-4" aria-hidden />
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-px">
				<span className="truncate text-[14.5px] font-semibold">{title}</span>
				<span className="truncate text-[11.5px] text-muted-foreground">{subtitle}</span>
			</span>
			{onDelete && (
				<button
					onClick={onDelete}
					disabled={busy}
					className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:opacity-70 disabled:opacity-50"
					aria-label={t('scorerPage.deleteGoal')}
				>
					<Trash2 className="size-4" aria-hidden />
				</button>
			)}
		</div>
	);
}

/** The bar at the bottom of the screen: a big goal button per team, and whatever follows them. */
export function GoalBar({
	teams,
	onGoal,
	children,
}: {
	teams: { id: string; name: string; primaryColor?: string | null }[];
	onGoal: (teamId: string) => void;
	children?: ReactNode;
}) {
	const { t } = useTranslation();
	return (
		<div className="sticky bottom-0 shrink-0 border-t border-border bg-background/95 backdrop-blur">
			<div className="mx-auto flex max-w-xl flex-col gap-2 px-4 py-3">
				<div className="grid grid-cols-2 gap-2">
					{teams.map((team) => (
						<button
							key={team.id}
							type="button"
							onClick={() => onGoal(team.id)}
							className="flex h-14 min-w-0 items-center justify-center gap-1.5 rounded-[12px] px-2 text-[15px] font-bold text-white"
							style={{ backgroundColor: team.primaryColor || NAVY }}
						>
							<Plus className="size-4 shrink-0" aria-hidden />
							<span className="truncate">{t('scorerPage.goalFor', { team: team.name })}</span>
						</button>
					))}
				</div>
				{children}
			</div>
		</div>
	);
}

export function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
	return (
		<div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5">
			<span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
			<p className="text-[13px] leading-snug">{children}</p>
		</div>
	);
}

export function DeadEnd({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
			<span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</span>
			<h1 className="text-lg font-bold">{title}</h1>
			<p className="max-w-sm text-sm text-muted-foreground">{text}</p>
		</div>
	);
}
