import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, Edit, Trophy, Target } from 'lucide-react';
import { toast } from 'sonner';
import { playerApi, gameStatisticApi, teamApi } from '@/services/api';

import { Card, CardContent, CardHeader, CardTitle } from "@components/base/card.tsx";
import { Button } from "@components/base/button.tsx";
import { Badge } from "@components/base/badge.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@components/base/dialog.tsx";
import { Input } from "@components/base/input.tsx";
import { Label } from "@components/base/label.tsx";
import { Textarea } from "@components/base/textarea.tsx";
import type { Player, Team, GameStatistic } from "@types";

export default function PlayerDetailPage() {
	const { id: teamId, playerId } = useParams<{ id: string; playerId: string }>();
	const navigate = useNavigate();
	const { t } = useTranslation();
	const isNew = playerId === 'new';

	const [loading, setLoading] = useState(!isNew);
	const [saving, setSaving] = useState(false);
	const [team, setTeam] = useState<Team | null>(null);
	const [player, setPlayer] = useState<Player | null>(null);
	const [statistics, setStatistics] = useState<GameStatistic[]>([]);
	const [showEditModal, setShowEditModal] = useState(isNew);
	const [formData, setFormData] = useState({
		name: '',
		number: '',
		position: '',
		bornYear: '',
		note: '',
	});

	useEffect(() => {
		if (!teamId) return;

		const fetchData = async () => {
			try {
				const teamRes = await teamApi.getById(teamId);
				setTeam(teamRes.data);

				if (!isNew && playerId) {
					const [playerRes, statsRes] = await Promise.all([
						playerApi.getById(playerId),
						gameStatisticApi.getByPlayer(playerId)
					]);
					const playerData = playerRes.data;
					setPlayer(playerData);
					setStatistics(statsRes.data);
					setFormData({
						name: playerData.name || '',
						number: playerData.number?.toString() || '',
						position: playerData.position || '',
						bornYear: playerData.bornYear?.toString() || '',
						note: playerData.note || '',
					});
				}
			} catch (error) {
				toast.error(t('teamManagement.playerDetail.fetchError'));
				navigate(`/team-management/${teamId}`);
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [teamId, playerId, isNew, t, navigate]);

	const handleSave = async () => {
		if (!teamId) return;

		setSaving(true);
		try {
			const playerData = {
				name: formData.name,
				number: formData.number ? parseInt(formData.number) : null,
				position: formData.position || null,
				bornYear: formData.bornYear ? parseInt(formData.bornYear) : null,
				note: formData.note || null,
			};

			if (isNew) {
				const res = await playerApi.create(teamId, playerData);
				toast.success(t('teamManagement.playerDetail.createSuccess'));
				navigate(`/team-management/${teamId}/player/${res.data.id}`, { replace: true });
			} else if (playerId) {
				const res = await playerApi.update(playerId, playerData);
				setPlayer(res.data);
				toast.success(t('teamManagement.playerDetail.saveSuccess'));
				setShowEditModal(false);
			}
		} catch (error) {
			toast.error(t('teamManagement.playerDetail.saveError'));
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!playerId || isNew) return;
		if (!confirm(t('teamManagement.playerDetail.confirmDelete'))) return;

		try {
			await playerApi.delete(playerId);
			toast.success(t('teamManagement.playerDetail.deleteSuccess'));
			navigate(`/team-management/${teamId}`);
		} catch (error) {
			toast.error(t('teamManagement.playerDetail.deleteError'));
		}
	};

	// Calculate totals
	const totalGoals = statistics.reduce((sum, s) => sum + (s.goals || 0), 0);
	const totalAssists = statistics.reduce((sum, s) => sum + (s.assists || 0), 0);
	const gamesPlayed = statistics.length;

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	if (isNew) {
		return (
			<div className="space-y-4 p-4">
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate(`/team-management/${teamId}`)}
					>
						<ArrowLeft className="h-4 w-4 mr-1" />
						{t('common.back')}
					</Button>
				</div>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-lg">
							{t('teamManagement.playerDetail.addPlayer')}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">{t('teamManagement.playerDetail.name')} *</Label>
								<Input
									id="name"
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
									required
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="number">{t('teamManagement.playerDetail.number')}</Label>
									<Input
										id="number"
										type="number"
										min={0}
										max={99}
										value={formData.number}
										onChange={(e) => setFormData({ ...formData, number: e.target.value })}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="bornYear">{t('teamManagement.playerDetail.bornYear')}</Label>
									<Input
										id="bornYear"
										type="number"
										min={1900}
										max={new Date().getFullYear()}
										value={formData.bornYear}
										onChange={(e) => setFormData({ ...formData, bornYear: e.target.value })}
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="position">{t('teamManagement.playerDetail.position')}</Label>
								<Input
									id="position"
									value={formData.position}
									onChange={(e) => setFormData({ ...formData, position: e.target.value })}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="note">{t('teamManagement.playerDetail.note')}</Label>
								<Textarea
									id="note"
									value={formData.note}
									onChange={(e) => setFormData({ ...formData, note: e.target.value })}
									rows={3}
								/>
							</div>

							<div className="flex gap-2 pt-2">
								<Button
									variant="outline"
									className="flex-1"
									onClick={() => navigate(`/team-management/${teamId}`)}
								>
									{t('common.cancel')}
								</Button>
								<Button
									className="flex-1"
									onClick={handleSave}
									disabled={saving || !formData.name}
								>
									{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
									{t('common.create')}
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!player) {
		return (
			<div className="text-center py-12 text-muted-foreground">
				{t('teamManagement.playerDetail.notFound')}
			</div>
		);
	}

	return (
		<div className="space-y-4 p-4">
			<div className="flex items-center justify-between">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => navigate(`/team-management/${teamId}`)}
				>
					<ArrowLeft className="h-4 w-4 mr-1" />
					{t('common.back')}
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={() => setShowEditModal(true)}
				>
					<Edit className="h-4 w-4 mr-1" />
					{t('common.edit')}
				</Button>
			</div>

			{/* Player Info Card */}
			<Card>
				<CardContent className="pt-6">
					<div className="flex items-center gap-4">
						<div
							className="size-16 rounded-full flex items-center justify-center text-white font-bold text-2xl"
							style={{ backgroundColor: team?.primaryColor || '#003E7E' }}
						>
							{player.number || '?'}
						</div>
						<div className="flex-1">
							<h2 className="text-xl font-bold">{player.name}</h2>
							<div className="flex items-center gap-2 mt-1">
								{player.position && (
									<Badge variant="secondary">{player.position}</Badge>
								)}
								{player.bornYear && (
									<span className="text-sm text-muted-foreground">
										{t('teamManagement.playerDetail.born')} {player.bornYear}
									</span>
								)}
							</div>
							{player.note && (
								<p className="text-sm text-muted-foreground mt-2">{player.note}</p>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Stats Summary */}
			<div className="grid grid-cols-3 gap-3">
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold">{gamesPlayed}</div>
						<div className="text-xs text-muted-foreground mt-1">
							{t('teamManagement.playerDetail.gamesPlayed')}
						</div>
					</CardContent>
				</Card>
				<Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
					<CardContent className="p-4 text-center">
						<div className="flex items-center justify-center gap-1">
							<Target className="h-4 w-4 text-green-700" />
							<span className="text-2xl font-bold text-green-900">{totalGoals}</span>
						</div>
						<div className="text-xs text-green-700 mt-1">
							{t('teamManagement.playerDetail.goals')}
						</div>
					</CardContent>
				</Card>
				<Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
					<CardContent className="p-4 text-center">
						<div className="flex items-center justify-center gap-1">
							<Trophy className="h-4 w-4 text-blue-700" />
							<span className="text-2xl font-bold text-blue-900">{totalAssists}</span>
						</div>
						<div className="text-xs text-blue-700 mt-1">
							{t('teamManagement.playerDetail.assists')}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Games List */}
			<Card className="mb-8">
				<CardHeader className="pb-3">
					<CardTitle className="text-base">
						{t('teamManagement.playerDetail.gameHistory')}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{statistics.length > 0 ? (
						statistics.map((stat) => {
							const game = stat.game;
							if (!game) return null;

							const isHome = game.homeTeamId === parseInt(teamId!);
							const myScore = isHome ? game.homeScore : game.awayScore;
							const oppScore = isHome ? game.awayScore : game.homeScore;
							const opponent = isHome ? game.awayTeam : game.homeTeam;
							const hasScore = myScore != null && oppScore != null;
							const isWin = hasScore && myScore > oppScore;
							const isDraw = hasScore && myScore === oppScore;

							return (
								<div
									key={stat.id}
									className="flex items-center gap-3 p-3 border rounded-lg"
								>
									<div className="flex-1">
										<div className="font-medium text-sm">
											{isHome ? 'vs' : '@'} {opponent?.name}
										</div>
										<div className="text-xs text-muted-foreground">
											{game.date ? new Date(game.date).toLocaleDateString() : '-'}
										</div>
									</div>
									<div className="flex items-center gap-3">
										<div className="text-right text-sm">
											<div className="flex items-center gap-2">
												{stat.goals ? (
													<span className="text-green-600 font-medium">{stat.goals}G</span>
												) : null}
												{stat.assists ? (
													<span className="text-blue-600 font-medium">{stat.assists}A</span>
												) : null}
												{!stat.goals && !stat.assists && (
													<span className="text-muted-foreground">-</span>
												)}
											</div>
										</div>
										{hasScore && (
											<Badge
												variant={isWin ? 'default' : isDraw ? 'secondary' : 'destructive'}
												className={isWin ? 'bg-green-600' : ''}
											>
												{myScore}:{oppScore}
											</Badge>
										)}
									</div>
								</div>
							);
						})
					) : (
						<div className="text-center text-muted-foreground py-4">
							{t('teamManagement.playerDetail.noGames')}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Edit Modal */}
			<Dialog open={showEditModal} onOpenChange={setShowEditModal}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('teamManagement.playerDetail.editPlayer')}</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 pt-4">
						<div className="space-y-2">
							<Label htmlFor="edit-name">{t('teamManagement.playerDetail.name')} *</Label>
							<Input
								id="edit-name"
								value={formData.name}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								required
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="edit-number">{t('teamManagement.playerDetail.number')}</Label>
								<Input
									id="edit-number"
									type="number"
									min={0}
									max={99}
									value={formData.number}
									onChange={(e) => setFormData({ ...formData, number: e.target.value })}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="edit-bornYear">{t('teamManagement.playerDetail.bornYear')}</Label>
								<Input
									id="edit-bornYear"
									type="number"
									min={1900}
									max={new Date().getFullYear()}
									value={formData.bornYear}
									onChange={(e) => setFormData({ ...formData, bornYear: e.target.value })}
								/>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="edit-position">{t('teamManagement.playerDetail.position')}</Label>
							<Input
								id="edit-position"
								value={formData.position}
								onChange={(e) => setFormData({ ...formData, position: e.target.value })}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="edit-note">{t('teamManagement.playerDetail.note')}</Label>
							<Textarea
								id="edit-note"
								value={formData.note}
								onChange={(e) => setFormData({ ...formData, note: e.target.value })}
								rows={3}
							/>
						</div>

						<div className="flex gap-2 pt-2">
							<Button
								variant="destructive"
								onClick={handleDelete}
							>
								{t('common.delete')}
							</Button>
							<div className="flex-1" />
							<Button
								variant="outline"
								onClick={() => setShowEditModal(false)}
							>
								{t('common.cancel')}
							</Button>
							<Button
								onClick={handleSave}
								disabled={saving || !formData.name}
							>
								{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
								{t('common.save')}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
