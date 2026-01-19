import { useTranslation } from 'react-i18next';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@components/base/table.tsx';
import { Badge } from '@components/base/badge.tsx';
import { Button } from '@components/base/button.tsx';
import { Edit, Trash2 } from 'lucide-react';

import type { Season } from '@types';

interface SeasonsTableProps {
  seasons: Season[];
}

export default function SeasonsTable({ seasons }: SeasonsTableProps) {
  const { t } = useTranslation();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.tabs.season.th-name')}</TableHead>
          <TableHead>{t('admin.tabs.season.th-sportType')}</TableHead>
          <TableHead>{t('admin.tabs.season.th-startDate')}</TableHead>
          <TableHead>{t('admin.tabs.season.th-endDate')}</TableHead>
          <TableHead>{t('admin.tabs.season.th-status')}</TableHead>
          <TableHead>{t('admin.tabs.season.th-created')}</TableHead>
          <TableHead>{t('admin.tabs.season.th-manager')}</TableHead>
          <TableHead>{t('admin.tabs.season.th-teams-c')}</TableHead>
          <TableHead className="text-right">{t('admin.tabs.season.th-actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {seasons.map((season) => (
          <TableRow key={season.id}>
            <TableCell className="font-medium">{season.name}</TableCell>
            <TableCell>{season.sportType}</TableCell>
            <TableCell>{season.startDate}</TableCell>
            <TableCell>{season.endDate}</TableCell>
            <TableCell>
              <Badge variant="secondary">{season.status}</Badge>
            </TableCell>
            <TableCell>{season.createdAt}</TableCell>
            <TableCell>{season.manager?.name}</TableCell>
            <TableCell>{season._count?.teams}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm">
                      <Edit className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                      <Trash2 className="size-4 text-destructive" />
                  </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
