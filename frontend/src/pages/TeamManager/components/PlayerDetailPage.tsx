import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { playerApi, gameStatisticApi, teamApi } from '@/services/api';

import { Card, CardContent, CardHeader, CardTitle } from "@components/base/card.tsx";
import { Button } from "@components/base/button.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@components/base/dialog.tsx";
import { Input } from "@components/base/input.tsx";
import { Label } from "@components/base/label.tsx";
import { Textarea } from "@components/base/textarea.tsx";
import type { Player, Team, HockeyGameStatistic } from "@types";

export default function PlayerDetailPage() {
	const { id: teamId, playerId } = useParams<{ id: string; playerId: string }>();
	const navigate = useNavigate();
	const { t, i18n } = useTranslation();
	const isNew = playerId === 'new';

	const [loading, setLoading] = useState(!isNew);
	const [saving, setSaving] = useState(false);
	const [team, setTeam] = useState<Team | null>(null);
	const [player, setPlayer] = useState<Player | null>(null);
	const [statistics, setStatistics] = useState<HockeyGameStatistic[]>([]);
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
	const totalPoints = totalGoals + totalAssists;
	const totalPenaltyMinutes = statistics.reduce((sum, s) => sum + (s.penaltyMinutes || 0), 0);

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
			<div
				className="flex items-center gap-4 rounded-xl p-4 text-white"
				style={{ backgroundColor: team?.primaryColor || '#003E7E' }}
			>
				<div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-white/35 bg-black/15 text-2xl font-bold">
					{player.number ?? '–'}
				</div>
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-xl font-bold">{player.name}</h2>
					<div className="mt-1 flex flex-wrap items-center gap-2">
						{player.position && (
							<span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11.5px] font-semibold">
								{player.position}
							</span>
						)}
						{player.bornYear && (
							<span className="text-xs text-white/85">
								{t('teamManagement.playerDetail.born')} {player.bornYear}
							</span>
						)}
					</div>
				</div>
			</div>

			{/* Stats Summary */}
			<div className="grid grid-cols-5 gap-1.5">
				{[
					{ value: gamesPlayed, label: t('teamManagement.playerDetail.gamesPlayed'), color: undefined },
					{ value: totalGoals, label: t('teamManagement.playerDetail.goals'), color: '#166534' },
					{ value: totalAssists, label: t('teamManagement.playerDetail.assists'), color: undefined },
					{ value: totalPoints, label: t('teamManagement.pwa.points'), color: team?.primaryColor || '#003E7E' },
					{ value: totalPenaltyMinutes, label: t('teamManagement.gameStats.penaltyMinutesShort'), color: '#92400e' },
				].map((tile) => (
					<div
						key={tile.label}
						className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-card px-1 py-2.5"
					>
						<span className="text-lg font-bold leading-none tabular-nums" style={{ color: tile.color }}>
							{tile.value}
						</span>
						<span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
							{tile.label}
						</span>
					</div>
				))}
			</div>

			{player.note && (
				<div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3.5">
					<span className="tm-section-label">{t('teamManagement.playerDetail.note')}</span>
					<p className="text-sm leading-relaxed text-muted-foreground" style={{ textWrap: 'pretty' }}>
						{player.note}
					</p>
				</div>
			)}

			{/* Games List */}
			<div className="flex flex-col gap-2 mb-4">
				<span className="tm-section-label">{t('teamManagement.playerDetail.gameHistory')}</span>
				{statistics.length > 0 ? (
					<div className="tm-rows-card">
						{statistics.map((stat) => {
							const game = stat.game;
							if (!game) return null;

							const isHome = game.homeTeamId === teamId!;
							const myScore = isHome ? game.homeScore : game.awayScore;
							const oppScore = isHome ? game.awayScore : game.homeScore;
							const opponent = isHome ? game.awayTeam : game.homeTeam;
							const hasScore = myScore != null && oppScore != null;
							const result = !hasScore ? null
								: myScore > oppScore ? 'win'
								: myScore === oppScore ? 'draw' : 'loss';
							const tone = result === 'win' ? { bg: '#dcfce7', fg: '#166534' }
								: result === 'draw' ? { bg: '#fef3c7', fg: '#92400e' }
								: { bg: '#fee2e2', fg: '#991b1b' };
							const points = [
								stat.goals ? t('teamManagement.playerDetail.goalsShort', { count: stat.goals }) : null,
								stat.assists ? t('teamManagement.playerDetail.assistsShort', { count: stat.assists }) : null,
								stat.penaltyMinutes ? `${stat.penaltyMinutes} ${t('teamManagement.gameStats.penaltyMinutesShort')}` : null,
							].filter(Boolean).join(' · ');

							return (
								<div key={stat.id} className="tm-compact-row py-2">
									<span className="w-11 shrink-0 whitespace-nowrap text-[11.5px] text-muted-foreground">
										{game.date
											? new Date(game.date).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
											: '—'}
									</span>
									<span className="flex min-w-0 flex-1 flex-col gap-0.5">
										<span className="truncate text-sm font-medium">
											{opponent?.name} ({isHome ? t('teamManagement.pwa.homeShort') : t('teamManagement.pwa.awayShort')})
										</span>
										<span className="text-[11.5px] text-muted-foreground">
											{points || t('teamManagement.playerDetail.noPoints')}
										</span>
									</span>
									{hasScore && (
										<span
											className="tm-status-pill tabular-nums"
											style={{ backgroundColor: tone.bg, color: tone.fg }}
										>
											{myScore}:{oppScore}
										</span>
									)}
								</div>
							);
						})}
					</div>
				) : (
					<div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
						{t('teamManagement.playerDetail.noGames')}
					</div>
				)}
			</div>

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
