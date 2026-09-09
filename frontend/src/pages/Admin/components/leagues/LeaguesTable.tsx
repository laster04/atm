import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@components/base/table.tsx';
import { Button } from '@components/base/button.tsx';
import { Card, CardContent, CardHeader } from '@components/base/card.tsx';
import { Dialog, DialogContent, DialogTrigger } from '@components/base/dialog.tsx';
import { Calendar, Edit, Plus, Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

import type { League } from '@types';
import LeagueFormModal, { type LeagueFormData } from './LeagueFormModal.tsx';
import { AdminTableView, AdminCardView, AdminCard, AdminCardField } from '../shared/AdminList';
import InviteLeagueManagerModal from './InviteLeagueManagerModal.tsx';

interface LeaguesTableProps {
	leagues: League[];
	onCreateLeague?: (data: LeagueFormData) => void;
	onUpdateLeague?: (id: string, data: LeagueFormData) => void;
	onDeleteLeague?: (id: string) => void;
	onInviteManager?: (league: League) => void;
}

export default function LeaguesTable({ leagues, onCreateLeague, onUpdateLeague, onDeleteLeague, onInviteManager }: LeaguesTableProps) {
	const { t } = useTranslation();
	const { isAdmin } = useAuth();
	const navigate = useNavigate();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingLeague, setEditingLeague] = useState<League | null>(null);
	const [invitingLeague, setInvitingLeague] = useState<League | null>(null);

	const handleOpenCreate = () => {
		setEditingLeague(null);
		setIsModalOpen(true);
	};

	const handleOpenEdit = (league: League) => {
		setEditingLeague(league);
		setIsModalOpen(true);
	};

	const handleClose = () => {
		setIsModalOpen(false);
		setEditingLeague(null);
	};

	// Identical in the table and the card list, so defined once.
	const rowActions = (league: League) => (
		<>
			<Button
				variant="ghost"
				size="sm"
				onClick={() => navigate(`/admin/seasons?leagueId=${league.id}`)}
				title={t('admin.tabs.league.goToSeasons')}
			>
				<Calendar className="size-4" />
			</Button>
			{isAdmin() && (
				<Button variant="ghost" size="sm" onClick={() => setInvitingLeague(league)}>
					<UserPlus className="size-4" />
				</Button>
			)}
			<Button variant="ghost" size="sm" onClick={() => handleOpenEdit(league)}>
				<Edit className="size-4" />
			</Button>
			<Button variant="ghost" size="sm" onClick={() => onDeleteLeague?.(league.id)}>
				<Trash2 className="size-4 text-destructive" />
			</Button>
		</>
	);

	const handleSubmit = (data: LeagueFormData) => {
		if (editingLeague) {
			onUpdateLeague?.(editingLeague.id, data);
		} else {
			onCreateLeague?.(data);
		}
		handleClose();
	};

	return (
		<>
		<Card className="border-0 bg-transparent shadow-none rounded-none sm:border sm:bg-card sm:rounded-xl">
			<CardHeader className="px-0 sm:px-6">
				<div className="flex items-center justify-end">
					<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
						<DialogTrigger asChild>
							<Button onClick={handleOpenCreate}>
								<Plus className="size-4 mr-2" />
								{t('admin.tabs.league.addLeague')}
							</Button>
						</DialogTrigger>
						<DialogContent>
							<LeagueFormModal
								league={editingLeague}
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
								<TableHead>{t('admin.tabs.league.th-name')}</TableHead>
								<TableHead>{t('admin.tabs.league.th-sportType')}</TableHead>
								<TableHead>{t('admin.tabs.league.th-description')}</TableHead>
								<TableHead>{t('admin.tabs.league.th-manager')}</TableHead>
								<TableHead>{t('admin.tabs.league.th-seasons-c')}</TableHead>
								<TableHead className="text-right">{t('admin.tabs.league.th-actions')}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{leagues.map((league) => (
								<TableRow key={league.id}>
									<TableCell className="font-medium">
										<button
											type="button"
											onClick={() => navigate(`/admin/seasons?leagueId=${league.id}`)}
											className="hover:underline text-left"
										>
											{league.name}
										</button>
									</TableCell>
									<TableCell>{t(`sports.${league.sportType}`)}</TableCell>
									<TableCell className="max-w-xs truncate">{league.description || '-'}</TableCell>
									<TableCell>{league.manager?.name || '-'}</TableCell>
									<TableCell>{league._count?.seasons || 0}</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-1">{rowActions(league)}</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</AdminTableView>

				<AdminCardView>
					{leagues.map((league) => (
						<AdminCard
							key={league.id}
							title={
								<button
									type="button"
									onClick={() => navigate(`/admin/seasons?leagueId=${league.id}`)}
									className="text-left hover:underline"
								>
									{league.name}
								</button>
							}
							actions={rowActions(league)}
						>
							<AdminCardField label={t('admin.tabs.league.th-sportType')}>
								{t(`sports.${league.sportType}`)}
							</AdminCardField>
							<AdminCardField label={t('admin.tabs.league.th-manager')}>
								{league.manager?.name || '-'}
							</AdminCardField>
							<AdminCardField label={t('admin.tabs.league.th-seasons-c')}>
								{league._count?.seasons || 0}
							</AdminCardField>
							<AdminCardField label={t('admin.tabs.league.th-description')}>
								{league.description || '-'}
							</AdminCardField>
						</AdminCard>
					))}
				</AdminCardView>
			</CardContent>
		</Card>

		{invitingLeague && (
			<InviteLeagueManagerModal
				leagueId={invitingLeague.id}
				onSuccess={(league) => {
					onInviteManager?.(league);
					setInvitingLeague(null);
				}}
				onClose={() => setInvitingLeague(null)}
			/>
		)}
		</>
	);
}
