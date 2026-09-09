import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@components/base/table.tsx';
import { Badge } from '@components/base/badge.tsx';
import { Button } from '@components/base/button.tsx';
import { Card, CardContent, CardHeader } from '@components/base/card.tsx';
import { Dialog, DialogContent, DialogTrigger } from '@components/base/dialog.tsx';
import { Archive, ArrowLeft, Calendar, Edit, Plus, Trash2, Users } from 'lucide-react';

import { formatDateLocale } from '@/utils/date';
import type { Season, League } from '@types';
import SeasonFormModal, { type SeasonFormData } from './SeasonFormModal.tsx';
import { AdminTableView, AdminCardView, AdminCard, AdminCardField } from '../shared/AdminList';

interface SeasonsTableProps {
	seasons: Season[];
	leagues: League[];
	selectedLeague?: League | null;
	onCreateSeason?: (data: SeasonFormData) => void;
	onUpdateSeason?: (id: string, data: SeasonFormData) => void;
	onDeleteSeason?: (id: string) => void;
	onArchiveSeason?: (id: string) => void;
}

export default function SeasonsTable({ seasons, leagues, selectedLeague, onCreateSeason, onUpdateSeason, onDeleteSeason, onArchiveSeason }: SeasonsTableProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingSeason, setEditingSeason] = useState<Season | null>(null);

	const handleOpenCreate = () => {
		setEditingSeason(null);
		setIsModalOpen(true);
	};

	const handleOpenEdit = (season: Season) => {
		setEditingSeason(season);
		setIsModalOpen(true);
	};

	const handleClose = () => {
		setIsModalOpen(false);
		setEditingSeason(null);
	};

	// Shared by the table and the card list.
	const statusBadges = (season: Season) => (
		<div className="flex items-center gap-1">
			<Badge variant="secondary">{t(`seasons.status.${season.status}`)}</Badge>
			{season.archivedAt && <Badge variant="secondary">{t('seasons.archived')}</Badge>}
		</div>
	);

	const rowActions = (season: Season) => (
		<>
			<Button
				variant="ghost"
				size="sm"
				onClick={() => navigate(`/admin/teams?seasonId=${season.id}`)}
				title={t('admin.tabs.season.goToTeams')}
			>
				<Users className="size-4" />
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onClick={() => navigate(`/admin/games?seasonId=${season.id}`)}
				title={t('admin.tabs.season.goToGames')}
			>
				<Calendar className="size-4" />
			</Button>
			{season.status === 'COMPLETED' && !season.archivedAt && (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onArchiveSeason?.(season.id)}
					title={t('admin.tabs.season.archiveSeason')}
				>
					<Archive className="size-4" />
				</Button>
			)}
			<Button variant="ghost" size="sm" onClick={() => handleOpenEdit(season)}>
				<Edit className="size-4" />
			</Button>
			{!season.archivedAt && (
				<Button variant="ghost" size="sm" onClick={() => onDeleteSeason?.(season.id)}>
					<Trash2 className="size-4 text-destructive" />
				</Button>
			)}
		</>
	);

	const handleSubmit = (data: SeasonFormData) => {
		if (editingSeason) {
			onUpdateSeason?.(editingSeason.id, data);
		} else {
			onCreateSeason?.(data);
		}
		handleClose();
	};

	const getLeagueName = (season: Season) => {
		if (season.league) {
			return `${season.league.name} (${t(`sports.${season.league.sportType}`)})`;
		}
		const league = leagues.find(l => l.id === season.leagueId);
		if (league) {
			return `${league.name} (${t(`sports.${league.sportType}`)})`;
		}
		return '-';
	};

	return (
		<Card className="border-0 bg-transparent shadow-none rounded-none sm:border sm:bg-card sm:rounded-xl">
			<CardHeader className="px-0 sm:px-6">
				<div className="flex items-center justify-between gap-2">
					{selectedLeague ? (
						<div className="flex items-center gap-2 min-w-0">
							<Button variant="ghost" size="sm" onClick={() => navigate('/admin/leagues')}>
								<ArrowLeft className="size-4" />
							</Button>
							<h2 className="font-semibold truncate">
								{selectedLeague.name} ({t(`sports.${selectedLeague.sportType}`)})
							</h2>
						</div>
					) : <div />}
					<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
						<DialogTrigger asChild>
							<Button onClick={handleOpenCreate} disabled={leagues.length === 0}>
								<Plus className="size-4 mr-2" />
								{t('admin.tabs.season.addSeason')}
							</Button>
						</DialogTrigger>
						<DialogContent>
							<SeasonFormModal
								season={editingSeason}
								leagues={leagues}
								seasons={seasons}
								onSubmit={handleSubmit}
								onClose={handleClose}
							/>
						</DialogContent>
					</Dialog>
				</div>
			</CardHeader>
			<CardContent className="px-0 sm:px-6">
				<AdminTableView>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('admin.tabs.season.th-name')}</TableHead>
								<TableHead>{t('admin.tabs.season.th-league')}</TableHead>
								<TableHead>{t('admin.tabs.season.th-startDate')}</TableHead>
								<TableHead>{t('admin.tabs.season.th-endDate')}</TableHead>
								<TableHead>{t('admin.tabs.season.th-status')}</TableHead>
								<TableHead>{t('admin.tabs.season.th-teams-c')}</TableHead>
								<TableHead className="text-right">{t('admin.tabs.season.th-actions')}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{seasons.map((season) => (
								<TableRow key={season.id}>
									<TableCell className="font-medium">{season.name}</TableCell>
									<TableCell>{getLeagueName(season)}</TableCell>
									<TableCell>{formatDateLocale(season.startDate)}</TableCell>
									<TableCell>{formatDateLocale(season.endDate)}</TableCell>
									<TableCell>
										{statusBadges(season)}
									</TableCell>
									<TableCell>{season._count?.seasonTeams ?? season._count?.teams ?? 0}</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-1">{rowActions(season)}</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</AdminTableView>

				<AdminCardView>
					{seasons.map((season) => (
						<AdminCard key={season.id} title={season.name} actions={rowActions(season)}>
							<AdminCardField label={t('admin.tabs.season.th-league')}>
								{getLeagueName(season)}
							</AdminCardField>
							{/* Both dates on one line: they are read as a span, not two facts. */}
							<AdminCardField label={t('admin.tabs.season.th-startDate')}>
								{formatDateLocale(season.startDate)} – {formatDateLocale(season.endDate)}
							</AdminCardField>
							<AdminCardField label={t('admin.tabs.season.th-status')}>
								{statusBadges(season)}
							</AdminCardField>
							<AdminCardField label={t('admin.tabs.season.th-teams-c')}>
								{season._count?.seasonTeams ?? season._count?.teams ?? 0}
							</AdminCardField>
						</AdminCard>
					))}
				</AdminCardView>
			</CardContent>
		</Card>
	);
}
