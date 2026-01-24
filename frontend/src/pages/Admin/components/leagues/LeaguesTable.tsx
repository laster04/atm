import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@components/base/table.tsx';
import { Button } from '@components/base/button.tsx';
import { Card, CardContent, CardHeader } from '@components/base/card.tsx';
import { Dialog, DialogContent, DialogTrigger } from '@components/base/dialog.tsx';
import { Edit, Plus, Trash2 } from 'lucide-react';

import type { League } from '@types';
import LeagueFormModal, { type LeagueFormData } from './LeagueFormModal.tsx';

interface LeaguesTableProps {
	leagues: League[];
	onCreateLeague?: (data: LeagueFormData) => void;
	onUpdateLeague?: (id: number, data: LeagueFormData) => void;
	onDeleteLeague?: (id: number) => void;
}

export default function LeaguesTable({ leagues, onCreateLeague, onUpdateLeague, onDeleteLeague }: LeaguesTableProps) {
	const { t } = useTranslation();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingLeague, setEditingLeague] = useState<League | null>(null);

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

	const handleSubmit = (data: LeagueFormData) => {
		if (editingLeague) {
			onUpdateLeague?.(editingLeague.id, data);
		} else {
			onCreateLeague?.(data);
		}
		handleClose();
	};

	return (
		<Card>
			<CardHeader>
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
			<CardContent>
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
								<TableCell className="font-medium">{league.name}</TableCell>
								<TableCell>{t(`sports.${league.sportType}`)}</TableCell>
								<TableCell className="max-w-xs truncate">{league.description || '-'}</TableCell>
								<TableCell>{league.manager?.name || '-'}</TableCell>
								<TableCell>{league._count?.seasons || 0}</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-1">
										<Button variant="ghost" size="sm" onClick={() => handleOpenEdit(league)}>
											<Edit className="size-4" />
										</Button>
										<Button variant="ghost" size="sm" onClick={() => onDeleteLeague?.(league.id)}>
											<Trash2 className="size-4 text-destructive" />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
