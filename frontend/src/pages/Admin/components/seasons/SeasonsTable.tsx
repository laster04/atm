import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@components/base/table.tsx';
import { Badge } from '@components/base/badge.tsx';
import { Button } from '@components/base/button.tsx';
import { Card, CardContent, CardHeader } from '@components/base/card.tsx';
import { Dialog, DialogContent, DialogTrigger } from '@components/base/dialog.tsx';
import { Edit, Plus, Trash2 } from 'lucide-react';

import type { Season } from '@types';
import SeasonFormModal, { type SeasonFormData } from './SeasonFormModal.tsx';

interface SeasonsTableProps {
	seasons: Season[];
	onCreateSeason?: (data: SeasonFormData) => void;
	onUpdateSeason?: (id: number, data: SeasonFormData) => void;
	onDeleteSeason?: (id: number) => void;
}

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString();
}

export default function SeasonsTable({ seasons, onCreateSeason, onUpdateSeason, onDeleteSeason }: SeasonsTableProps) {
	const { t } = useTranslation();
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

	const handleSubmit = (data: SeasonFormData) => {
		if (editingSeason) {
			onUpdateSeason?.(editingSeason.id, data);
		} else {
			onCreateSeason?.(data);
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
								{t('admin.tabs.season.addSeason')}
							</Button>
						</DialogTrigger>
						<DialogContent>
							<SeasonFormModal
								season={editingSeason}
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
							<TableHead>{t('admin.tabs.season.th-name')}</TableHead>
							<TableHead>{t('admin.tabs.season.th-sportType')}</TableHead>
							<TableHead>{t('admin.tabs.season.th-startDate')}</TableHead>
							<TableHead>{t('admin.tabs.season.th-endDate')}</TableHead>
							<TableHead>{t('admin.tabs.season.th-status')}</TableHead>
							<TableHead>{t('admin.tabs.season.th-manager')}</TableHead>
							<TableHead>{t('admin.tabs.season.th-teams-c')}</TableHead>
							<TableHead className="text-right">{t('admin.tabs.season.th-actions')}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{seasons.map((season) => (
							<TableRow key={season.id}>
								<TableCell className="font-medium">{season.name}</TableCell>
								<TableCell>{t(`sports.${season.sportType}`)}</TableCell>
								<TableCell>{formatDate(season.startDate)}</TableCell>
								<TableCell>{formatDate(season.endDate)}</TableCell>
								<TableCell>
									<Badge variant="secondary">{t(`seasons.status.${season.status}`)}</Badge>
								</TableCell>
								<TableCell>{season.manager?.name || '-'}</TableCell>
								<TableCell>{season._count?.teams || 0}</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-1">
										<Button variant="ghost" size="sm" onClick={() => handleOpenEdit(season)}>
											<Edit className="size-4" />
										</Button>
										<Button variant="ghost" size="sm" onClick={() => onDeleteSeason?.(season.id)}>
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
