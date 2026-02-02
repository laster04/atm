import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Award, Target, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { teamApi, playerApi, seasonApi } from '@/services/api';
import { Button } from '@components/base/button.tsx';
import type { Player, Standing, Team } from '@types';
import RosterTable from '../TeamDetail/components/RosterTable';
import GamesList from '../TeamDetail/components/GamesList';
import PlayerFormModal, { type PlayerFormData } from '../TeamDetail/components/PlayerFormModal';
import TeamColorPicker from './components/TeamColorPicker';
import { Card, CardTitle, CardHeader, CardDescription, CardContent } from "@/components/base/card";

export default function Detail() {
	const { id } = useParams<{ id: string }>();
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { canManageTeam, isAdmin } = useAuth();
	const [standing, setStanding] = useState<Standing | undefined>();

	const [team, setTeam] = useState<Team | null>(null);
	const [players, setPlayers] = useState<Player[]>([]);
	const [loading, setLoading] = useState(false);
	const [localColor, setLocalColor] = useState<string | null | undefined>(null);

	const [showPlayerModal, setShowPlayerModal] = useState(false);
	const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

	useEffect(() => {
		if (!id) return;
		setLoading(true);
		Promise.all([
			teamApi.getById(id),
			playerApi.getByTeam(id)
		])
			.then(([teamRes, playersRes]) => {
				setTeam(teamRes.data);
				setPlayers(playersRes.data);
				setLocalColor(teamRes.data.primaryColor);
			})
			.catch((err) => console.error(err))
			.finally(() => setLoading(false));
	}, [id]);

	useEffect(() => {
		const fetchData = async () => {
			if (!team || !team.season) return;
			try {
				const standingsRes = await seasonApi.getTeamStanding(team.season.id, team.id);
				setStanding(standingsRes.data);
			} catch (error) {
				console.error('Failed to fetch season data:', error);
			}
		};

		fetchData();
	}, [team]);

	const openAddPlayer = () => {
		setEditingPlayer(null);
		setShowPlayerModal(true);
	};

	const openEditPlayer = (player: Player) => {
		setEditingPlayer(player);
		setShowPlayerModal(true);
	};

	const handleSavePlayer = async (data: PlayerFormData) => {
		if (!team) return;
		const playerData = {
			name: data.name,
			number: data.number ? parseInt(data.number) : undefined,
			position: data.position || undefined,
		};

		if (editingPlayer) {
			const res = await playerApi.update(editingPlayer.id, playerData);
			setPlayers((prev) => prev.map((p) => (p.id === editingPlayer.id ? res.data : p)));
		} else {
			const res = await playerApi.create(team.id, playerData);
			setPlayers((prev) => [...prev, res.data]);
		}
		setShowPlayerModal(false);
	};

	const handleDeletePlayer = async (playerId: number) => {
		if (!confirm(t('teamDetail.confirm.deletePlayer'))) return;
		if (!team) return;
		await playerApi.delete(playerId);
		setPlayers((prev) => prev.filter((p) => p.id !== playerId));
	};

	const handleBack = () => {
		if (isAdmin()) {
			navigate('/admin');
		} else {
			navigate('/team-management/my-teams');
		}
	};

	if (loading && !team) {
		return (
			<div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('teamDetail.loading')}</div>
		);
	}

	if (!team) {
		return (
			<div className="max-w-7xl mx-auto px-4 py-8 text-center">{t('teamDetail.notFound')}</div>
		);
	}

	const canManage = canManageTeam(team.managerId);

	if (!canManage) {
		return (
			<div className="max-w-7xl mx-auto px-4 py-8 text-center">
				<h1 className="text-2xl font-bold text-red-600">{t('myTeams.accessDenied')}</h1>
				<p className="text-gray-600 mt-2">{t('myTeams.noPrivileges')}</p>
			</div>
		);
	}

	const stats = [
		{
			title: t('teamManagement.stats.teamRecord'),
			value: standing ? `${standing.wins}-${standing.losses}-${standing?.draws}` : '',
			icon: Award
		},
		{
			title: t('teamManagement.stats.totalPoints'),
			value: standing ? standing.points.toString() : '',
			icon: TrendingUp
		},
		{ title: t('teamManagement.stats.leagueRank'), value: 'TODO:', icon: Target },
	];

	return (
		<div className="space-y-6">
			<Button variant="ghost" onClick={handleBack} className="mb-1">
				<ArrowLeft className="size-4 mr-2"/>
				{t('teamManagement.back')}
			</Button>
			<Card className="bg-gradient-to-r text-white" style={{ backgroundColor: localColor ?? undefined }}>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex-1">
							<CardTitle className="text-2xl">{team.name}</CardTitle>
							<CardDescription className="text-blue-100">
								{team.season && (
									team.season.name
								)}
								{team.manager && (
									<p className="text-sm mt-1">
										{t('teamDetail.manager', { name: team.manager.name })}
									</p>
								)}
							</CardDescription>
						</div>
						<div className="ml-4">

						</div>
					</div>
				</CardHeader>
			</Card>

			<div className="grid gap-4 md:grid-cols-3">
				{stats.map((stat) => (
					<Card key={stat.title}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm">{stat.title}</CardTitle>
							<stat.icon className="size-4 text-muted-foreground"/>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-medium">{stat.value}</div>
						</CardContent>
					</Card>
				))}
			</div>
				<TeamColorPicker
				teamId={team.id}
				teamName={team.name}
				initialColor={team.primaryColor}
				points={standing?.points}
				onColorChange={setLocalColor}
			/>

			<div className="grid lg:grid-cols-2 gap-6">
				<RosterTable
					players={players.length > 0 ? players : team.players || []}
					canManage={canManage}
					onAddPlayer={openAddPlayer}
					onEditPlayer={openEditPlayer}
					onDeletePlayer={handleDeletePlayer}
				/>

				<GamesList games={team.games || []} teamId={team.id}/>
			</div>

			{showPlayerModal && (
				<PlayerFormModal
					player={editingPlayer}
					onSubmit={handleSavePlayer}
					onClose={() => setShowPlayerModal(false)}
				/>
			)}
		</div>
	);
}
