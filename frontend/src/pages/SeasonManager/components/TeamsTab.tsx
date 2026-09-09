import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, User as UserIcon } from 'lucide-react';
import { AxiosError } from 'axios';
import { authApi, teamApi } from '@/services/api';
import { Role, type Season, type Team, type User } from '@types';
import TeamFormModal, { type TeamFormData } from '@/pages/Admin/components/teams/TeamFormModal';
import { SEASON_ACCENT, initials } from './util';

interface TeamsTabProps {
	season: Season;
	teams: Team[];
	onTeamsChange: (teams: Team[]) => void;
}

export default function TeamsTab({ season, teams, onTeamsChange }: TeamsTabProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [showForm, setShowForm] = useState(false);
	const [teamManagers, setTeamManagers] = useState<User[]>([]);
	const [error, setError] = useState('');

	useEffect(() => {
		authApi.getUsers({ role: Role.TEAM_MANAGER })
			.then((res) => setTeamManagers(res.data))
			.catch((err) => console.error(err));
	}, []);

	const handleCreate = async (data: TeamFormData) => {
		setError('');
		try {
			const res = await teamApi.create(season.id, {
				name: data.name,
				managerId: data.managerId ? data.managerId : undefined,
			});
			onTeamsChange([...teams, res.data]);
			setShowForm(false);
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.data?.error || t('seasonManagement.teams.createError'));
		}
	};

	return (
		<div className="flex flex-col gap-2.5">
			{error && <p className="text-sm text-red-600">{error}</p>}

			{teams.length === 0 ? (
				<div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
					{t('seasonManagement.teams.empty')}
				</div>
			) : (
				teams.map((team) => {
					const color = team.primaryColor || SEASON_ACCENT;
					const unmanaged = !team.manager;
					return (
						<button
							key={team.id}
							onClick={() => navigate(`/team-management/${team.id}`)}
							className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-colors active:bg-muted"
							style={{ borderLeft: `4px solid ${color}` }}
						>
							<span
								className="flex size-[42px] shrink-0 items-center justify-center rounded-[11px] text-sm font-bold text-white"
								style={{ backgroundColor: color }}
							>
								{initials(team.name)}
							</span>
							<span className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="truncate text-[15.5px] font-semibold leading-tight">{team.name}</span>
								<span
									className="flex min-w-0 items-center gap-1.5 text-xs"
									style={{ color: unmanaged ? '#92400e' : undefined }}
								>
									<UserIcon className="size-3 shrink-0" aria-hidden />
									<span className={`truncate ${unmanaged ? '' : 'text-muted-foreground'}`}>
										{team.manager?.name || t('seasonManagement.teams.noManager')}
									</span>
								</span>
							</span>
							<span className="flex shrink-0 flex-col items-center gap-px">
								<span className="text-[15px] font-semibold tabular-nums">
									{team._count?.players ?? team.players?.length ?? 0}
								</span>
								<span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
									{t('seasonManagement.teams.players')}
								</span>
							</span>
							<ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
						</button>
					);
				})
			)}

			<button
				onClick={() => setShowForm(true)}
				className="tm-fab"
				style={{ backgroundColor: SEASON_ACCENT }}
			>
				<Plus className="size-5" aria-hidden />
				{t('seasonManagement.teams.add')}
			</button>

			{showForm && (
				<TeamFormModal
					teamManagers={teamManagers}
					onSubmit={handleCreate}
					onClose={() => setShowForm(false)}
				/>
			)}
		</div>
	);
}
