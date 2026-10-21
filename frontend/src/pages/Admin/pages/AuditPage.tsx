import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '@/services/api';
import type { AuditEntry } from '@types';
import DataList, { type ListColumn, type ListFilter } from '../components/list/DataList';
import DetailPanel, { PanelFacts } from '../components/list/DetailPanel';
import { useListParams } from '../components/list/useListParams';
import { AuditChanges } from '../components/audit/AuditChanges';
import { formatInstant } from '../components/format';

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'CONFIRM', 'REOPEN'];

/** What a line is about, as a person reads it: the record's name when the snapshot has one. */
export const auditSubject = (entry: AuditEntry): string => {
	const named = (entry.after?.name ?? entry.before?.name ?? entry.after?.email ?? entry.before?.email) as string | undefined;
	return named ?? entry.entityId.slice(0, 8);
};

export default function AuditPage() {
	const { t, i18n } = useTranslation();
	const { openId, setOpenId } = useListParams();
	const [types, setTypes] = useState<string[]>([]);
	const [open, setOpen] = useState<AuditEntry | null>(null);

	useEffect(() => {
		adminApi.auditTypes().then((res) => setTypes(res.data)).catch((error) => console.error(error));
	}, []);

	const section = (type: string) => t(`adminShell.audit.types.${type}`, type);
	const action = (value: string) => t(`adminShell.audit.actions.${value}`, value);

	const columns: ListColumn<AuditEntry>[] = [
		{ key: 'createdAt', label: t('adminShell.audit.when'), sort: 'createdAt', className: 'whitespace-nowrap tabular-nums', render: (row) => formatInstant(row.createdAt, i18n.language) },
		{ key: 'actor', label: t('adminShell.audit.who'), render: (row) => row.actor
			? <span className="flex flex-col"><span className="font-semibold">{row.actor.name}</span><span className="text-xs text-muted-foreground">{row.actor.email}</span></span>
			: <span className="text-muted-foreground">{t('adminShell.audit.system')}</span> },
		{ key: 'entityType', label: t('adminShell.audit.section'), render: (row) => section(row.entityType) },
		{ key: 'subject', label: t('adminShell.audit.record'), className: 'max-w-[220px] truncate', render: (row) => auditSubject(row) },
		{ key: 'action', label: t('adminShell.audit.action'), render: (row) => action(row.action) },
		{ key: 'reason', label: t('adminShell.audit.reason'), className: 'max-w-[260px] truncate text-muted-foreground', render: (row) => row.reason ?? '' },
	];

	const filters: ListFilter[] = [
		{ key: 'entityType', label: t('adminShell.audit.section'), type: 'select', options: types.map((type) => ({ value: type, label: section(type) })) },
		{ key: 'action', label: t('adminShell.audit.action'), type: 'select', options: ACTIONS.map((value) => ({ value, label: action(value) })) },
		{ key: 'actor', label: t('adminShell.audit.who'), type: 'text', placeholder: t('adminShell.audit.actorPlaceholder') },
		{ key: 'created', label: t('adminShell.audit.period'), type: 'dateRange' },
	];

	return (
		<div className="flex flex-wrap items-start gap-4">
			<div className="min-w-0 flex-[999_1_560px]">
				<DataList
					columns={columns}
					filters={filters}
					load={(query) => adminApi.audit(query).then((res) => res.data)}
					exportCsv={adminApi.exportAudit}
					defaultSort={{ sort: 'createdAt', dir: 'desc' }}
					searchLabel={t('adminShell.audit.search')}
					searchPlaceholder={t('adminShell.audit.searchPlaceholder')}
					onOpen={(row) => { setOpen(row); setOpenId(row.id); }}
					activeId={openId}
					rowLabel={auditSubject}
					empty={t('adminShell.audit.empty')}
					onLoad={(rows) => {
						if (openId && open?.id !== openId) setOpen(rows.find((row) => row.id === openId) ?? null);
					}}
				/>
			</div>
			{openId && open?.id === openId && (
				<DetailPanel
					key={open.id}
					kicker={`${section(open.entityType)} · ${action(open.action)}`}
					title={auditSubject(open)}
					onClose={() => { setOpenId(null); setOpen(null); }}
					tabs={[{
						key: 'overview',
						label: t('adminShell.panel.overview'),
						content: (
							<>
								<PanelFacts rows={[
									{ label: t('adminShell.audit.when'), value: formatInstant(open.createdAt, i18n.language) },
									{ label: t('adminShell.audit.who'), value: open.actor ? `${open.actor.name} · ${open.actor.email}` : t('adminShell.audit.system') },
									{ label: t('adminShell.audit.recordId'), value: <code className="text-xs">{open.entityId}</code> },
									...(open.reason ? [{ label: t('adminShell.audit.reason'), value: open.reason }] : []),
								]} />
								<AuditChanges entry={open} />
							</>
						),
					}]}
				/>
			)}
		</div>
	);
}
