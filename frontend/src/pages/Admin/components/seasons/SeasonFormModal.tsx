import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { SeasonStatus } from '@types';
import type { Season, League, Team } from '@types';
import { seasonApi } from '@/services/api';
import { Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel } from '@mui/material';
import { DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog.tsx';
import { Label } from '@components/base/label';
import { Input } from '@/components/base/input';
import { Button } from '@components/base/button';
import { formatDateForInput } from '@/utils/date';

interface SeasonFormData {
	name: string;
	leagueId: number;
	startDate: string;
	endDate: string;
	status: SeasonStatus;
	copyTeamIds?: number[];
}

interface SeasonFormModalProps {
	season: Season | null;
	leagues: League[];
	seasons?: Season[];
	onSubmit: (data: SeasonFormData) => void;
	onClose: () => void;
}

export default function SeasonFormModal({ season, leagues, seasons = [], onSubmit, onClose }: SeasonFormModalProps) {
	const { t } = useTranslation();
	const isEditing = !!season;
	const isArchived = !!season?.archivedAt;

	const initValues = {
		name: season?.name || '',
		leagueId: season?.leagueId || (leagues.length > 0 ? leagues[0].id : 0),
		startDate: formatDateForInput(season?.startDate),
		endDate: formatDateForInput(season?.endDate),
		status: season?.status || SeasonStatus.DRAFT,
	};

	const form = useForm<SeasonFormData>({
		defaultValues: initValues,
	});

	const watchedLeagueId = form.watch('leagueId');
	const [sourceSeasonId, setSourceSeasonId] = useState<number | ''>('');
	const [copyableTeams, setCopyableTeams] = useState<Team[]>([]);
	const [selectedTeamIds, setSelectedTeamIds] = useState<Set<number>>(new Set());
	const [loadingTeams, setLoadingTeams] = useState(false);

	const sourceCandidates = seasons.filter(
		(s) => s.leagueId === Number(watchedLeagueId) && s.status === SeasonStatus.COMPLETED
	);

	useEffect(() => {
		setSourceSeasonId('');
		setCopyableTeams([]);
		setSelectedTeamIds(new Set());
	}, [watchedLeagueId]);

	useEffect(() => {
		if (!sourceSeasonId) {
			setCopyableTeams([]);
			setSelectedTeamIds(new Set());
			return;
		}
		setLoadingTeams(true);
		seasonApi.getCopyableTeams(sourceSeasonId)
			.then((res) => {
				setCopyableTeams(res.data);
				setSelectedTeamIds(new Set(res.data.map((team) => team.id)));
			})
			.catch((err) => console.error('Failed to fetch copyable teams:', err))
			.finally(() => setLoadingTeams(false));
	}, [sourceSeasonId]);

	const toggleTeam = (teamId: number) => {
		setSelectedTeamIds((prev) => {
			const next = new Set(prev);
			if (next.has(teamId)) next.delete(teamId);
			else next.add(teamId);
			return next;
		});
	};

	const handleFormSubmit = (data: SeasonFormData) => {
		onSubmit(
			isEditing || selectedTeamIds.size === 0
				? { ...data, copyTeamIds: undefined }
				: { ...data, copyTeamIds: Array.from(selectedTeamIds) }
		);
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>{isEditing ? t('admin.modal.editSeason') : t('admin.modal.createSeason')}</DialogTitle>
				<DialogDescription>
					{isEditing ? t('admin.modal.editSeasonDesc') : t('admin.modal.createSeasonDesc')}
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={form.handleSubmit(handleFormSubmit)}>
				<div className="space-y-3 sm:space-y-4 pt-4">
					<div className="space-y-2">
						<Label>{t('admin.modal.name')}</Label>
						<Input
							type="text"
							{...form.register('name', { required: true })}
							className="w-full px-3 py-2.5 sm:py-2 border rounded"
							required
						/>
					</div>
					<div className="space-y-2">
						<FormControl className="w-full" size="small">
							<InputLabel id="select-league-label">{t('admin.modal.league')}</InputLabel>
							<Select
								MenuProps={{
									disablePortal: true,
								}}
								labelId="select-league-label"
								id="select-league"
								label={t('admin.modal.league')}
								disabled={isArchived}
								{...form.register('leagueId', { valueAsNumber: true })}
								defaultValue={initValues.leagueId}
							>
								{leagues.map((league) => (
									<MenuItem key={league.id} value={league.id}>
										{league.name} ({t(`sports.${league.sportType}`)})
									</MenuItem>
								))}
							</Select>
						</FormControl>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
						<div className="space-y-2">
							<Label>{t('admin.modal.startDate')}</Label>
							<Input
								type="date"
								{...form.register('startDate', { required: true })}
								className="w-full px-3 py-2.5 sm:py-2 border rounded"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label>{t('admin.modal.endDate')}</Label>
							<Input
								type="date"
								{...form.register('endDate', { required: true })}
								className="w-full px-3 py-2.5 sm:py-2 border rounded"
								required
							/>
						</div>
					</div>
					<div className="space-y-2">
						<FormControl className="w-full" size="small">
							<InputLabel id="select-season-status-label">{t('admin.modal.status')}</InputLabel>
							<Select
								MenuProps={{
									disablePortal: true,
								}}
								labelId="select-season-status-label"
								id="select-season-status"
								label={t('admin.modal.status')}
								disabled={isArchived}
								{...form.register('status')}
								defaultValue={initValues.status}
							>
								<MenuItem value={SeasonStatus.DRAFT}>{t('seasons.status.DRAFT')}</MenuItem>
								<MenuItem value={SeasonStatus.ACTIVE}>{t('seasons.status.ACTIVE')}</MenuItem>
								<MenuItem value={SeasonStatus.COMPLETED}>{t('seasons.status.COMPLETED')}</MenuItem>
							</Select>
						</FormControl>
					</div>

					{!isEditing && sourceCandidates.length > 0 && (
						<div className="space-y-2 border-t pt-3 sm:pt-4">
							<Label>{t('admin.modal.copyTeamsFrom')}</Label>
							<FormControl className="w-full" size="small">
								<InputLabel id="select-copy-source-label">{t('admin.modal.copyTeamsFromSeason')}</InputLabel>
								<Select
									MenuProps={{ disablePortal: true }}
									labelId="select-copy-source-label"
									id="select-copy-source"
									label={t('admin.modal.copyTeamsFromSeason')}
									value={sourceSeasonId}
									onChange={(e) => setSourceSeasonId(e.target.value ? Number(e.target.value) : '')}
								>
									<MenuItem value="">{t('admin.modal.copyTeamsNone')}</MenuItem>
									{sourceCandidates.map((s) => (
										<MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
									))}
								</Select>
							</FormControl>

							{loadingTeams && (
								<p className="text-sm text-muted-foreground">{t('common.loading')}</p>
							)}

							{!loadingTeams && sourceSeasonId && copyableTeams.length === 0 && (
								<p className="text-sm text-muted-foreground">{t('admin.modal.copyTeamsEmpty')}</p>
							)}

							{!loadingTeams && copyableTeams.length > 0 && (
								<div className="max-h-40 overflow-y-auto space-y-1 border rounded p-2">
									{copyableTeams.map((team) => (
										<FormControlLabel
											key={team.id}
											control={
												<Checkbox
													size="small"
													checked={selectedTeamIds.has(team.id)}
													onChange={() => toggleTeam(team.id)}
												/>
											}
											label={`${team.name} (${team._count?.players ?? 0})`}
										/>
									))}
								</div>
							)}
						</div>
					)}
				</div>

				<div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-4 sm:justify-end">
					<Button onClick={onClose} variant="outline" className="w-full sm:w-auto">
						{t('common.cancel')}
					</Button>
					<Button className="w-full sm:w-auto" type="submit">
						{isEditing ? t('common.save') : t('common.create')}
					</Button>
				</div>
			</form>
		</>
	);
}

export type { SeasonFormData };
