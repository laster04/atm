import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { adminApi } from '@/services/api';
import type { AuditEntry } from '@types';
import { formatInstant } from '../format';

const show = (value: unknown): string =>
	value === null || value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);

/** Field by field: what an audit line changed, old value next to the new one. */
export function AuditChanges({ entry }: { entry: AuditEntry }) {
	const { t } = useTranslation();
	const before = entry.before ?? {};
	const after = entry.after ?? {};
	const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])]
		.filter((field) => entry.action !== 'UPDATE' || show(before[field]) !== show(after[field]));

	if (fields.length === 0) return <p className="text-[13px] text-muted-foreground">{t('adminShell.audit.noChanges')}</p>;

	return (
		<table className="w-full table-fixed border-collapse text-[12.5px]">
			<thead>
				<tr className="text-left text-muted-foreground">
					<th scope="col" className="w-1/4 py-1 pr-2 font-semibold">{t('adminShell.audit.field')}</th>
					<th scope="col" className="py-1 pr-2 font-semibold">{t('adminShell.audit.before')}</th>
					<th scope="col" className="py-1 font-semibold">{t('adminShell.audit.after')}</th>
				</tr>
			</thead>
			<tbody>
				{fields.map((field) => (
					<tr key={field} className="border-t border-border align-top">
						<th scope="row" className="py-1.5 pr-2 text-left font-semibold">{field}</th>
						<td className="break-words py-1.5 pr-2 text-muted-foreground line-through decoration-1">{entry.before ? show(before[field]) : ''}</td>
						<td className="break-words py-1.5 font-semibold">{entry.after ? show(after[field]) : ''}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

/** One record's history, newest first: the panels' History tab. */
export function AuditTrail({ entityType, entityId }: { entityType: string; entityId: string }) {
	const { t, i18n } = useTranslation();
	const [entries, setEntries] = useState<AuditEntry[] | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		setEntries(null);
		setFailed(false);
		adminApi.audit({ entityType, entityId, pageSize: '100' })
			.then((res) => setEntries(res.data.rows))
			.catch((error) => {
				console.error(error);
				setFailed(true);
			});
	}, [entityType, entityId]);

	if (failed) return <p className="text-sm text-destructive">{t('adminShell.list.loadError')}</p>;
	if (!entries) return <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label={t('common.loading')} />;
	if (entries.length === 0) return <p className="text-[13px] text-muted-foreground">{t('adminShell.audit.emptyRecord')}</p>;

	return (
		<ol className="flex flex-col gap-3">
			{entries.map((entry) => (
				<li key={entry.id} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
					<div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
						<span className="font-bold">{t(`adminShell.audit.actions.${entry.action}`, entry.action)}</span>
						<span className="tabular-nums text-muted-foreground">{formatInstant(entry.createdAt, i18n.language)}</span>
					</div>
					<span className="text-[12.5px] text-muted-foreground">
						{entry.actor ? `${entry.actor.name} · ${entry.actor.email}` : t('adminShell.audit.system')}
					</span>
					{entry.reason && <p className="text-[13px]"><span className="text-muted-foreground">{t('adminShell.audit.reason')}: </span>{entry.reason}</p>}
					<AuditChanges entry={entry} />
				</li>
			))}
		</ol>
	);
}
