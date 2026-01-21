import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@components/base/table.tsx';
import { Button } from '@components/base/button.tsx';
import { Card, CardContent, CardHeader } from '@components/base/card.tsx';
import { Dialog, DialogContent, DialogTrigger } from '@components/base/dialog.tsx';
import { Edit, Eye, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';

import type { Team, Season, User } from '@types';
import TeamFormModal, { type TeamFormData } from './TeamFormModal.tsx';

interface TeamsTableProps {
	teams: Team[];
	seasons: Season[];
	selectedSeasonId: number | null;
	teamManagers: User[];
	onSeasonChange: (seasonId: number) => void;
	onCreateTeam?: (data: TeamFormData) => void;
	onUpdateTeam?: (id: number, data: TeamFormData) => void;
	onDeleteTeam?: (id: number) => void;
}

export default function TeamsTable({
	teams,
	seasons,
	selectedSeasonId,
	teamManagers,
	onSeasonChange,
	onCreateTeam,
	onUpdateTeam,
	onDeleteTeam,
}: TeamsTableProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingTeam, setEditingTeam] = useState<Team | null>(null);

	const handleOpenCreate = () => {
		setEditingTeam(null);
		setIsModalOpen(true);
	};

	const handleOpenEdit = (team: Team) => {
		setEditingTeam(team);
		setIsModalOpen(true);
	};

	const handleClose = () => {
		setIsModalOpen(false);
		setEditingTeam(null);
	};

	const handleSubmit = (data: TeamFormData) => {
		if (editingTeam) {
			onUpdateTeam?.(editingTeam.id, data);
		} else {
			onCreateTeam?.(data);
		}
		handleClose();
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-4">
					<FormControl size="small" sx={{ minWidth: 200 }}>
						<InputLabel id="team-season-filter-label">{t('admin.tabs.team.filterBySeason')}</InputLabel>
						<Select
							labelId="team-season-filter-label"
							value={selectedSeasonId || ''}
							label={t('admin.tabs.team.filterBySeason')}
							onChange={(e) => onSeasonChange(Number(e.target.value))}
						>
							{seasons.map((season) => (
								<MenuItem key={season.id} value={season.id}>
									{season.name}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
						<DialogTrigger asChild>
							<Button onClick={handleOpenCreate} disabled={!selectedSeasonId}>
								<Plus className="size-4 mr-2" />
								{t('admin.tabs.team.addTeam')}
							</Button>
						</DialogTrigger>
						<DialogContent>
							<TeamFormModal
								team={editingTeam}
								teamManagers={teamManagers}
								onSubmit={handleSubmit}
								onClose={handleClose}
							/>
						</DialogContent>
					</Dialog>
				</div>
			</CardHeader>
			<CardContent>
				{!selectedSeasonId ? (
					<div className="text-center py-8 text-muted-foreground">
						{t('admin.tabs.team.selectSeasonFirst')}
					</div>
				) : teams.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground">
						{t('admin.tabs.team.noTeams')}
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('admin.tabs.team.th-name')}</TableHead>
								<TableHead>{t('admin.tabs.team.th-manager')}</TableHead>
								<TableHead>{t('admin.tabs.team.th-players')}</TableHead>
								<TableHead className="text-right">{t('admin.tabs.team.th-actions')}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{teams.map((team) => (
								<TableRow key={team.id}>
									<TableCell className="font-medium">{team.name}</TableCell>
									<TableCell>{team.manager?.name || '-'}</TableCell>
									<TableCell>{team._count?.players || 0}</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-1">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => navigate(`/team-management/${team.id}`)}
												title={t('admin.tabs.team.goToDetail')}
											>
												<Eye className="size-4" />
											</Button>
											<Button variant="ghost" size="sm" onClick={() => handleOpenEdit(team)}>
												<Edit className="size-4" />
											</Button>
											<Button variant="ghost" size="sm" onClick={() => onDeleteTeam?.(team.id)}>
												<Trash2 className="size-4 text-destructive" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
