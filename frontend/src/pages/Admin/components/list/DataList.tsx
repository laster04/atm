import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Download, Loader2, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@components/base/popover';
import { cn } from '@/components/utils';
import type { ListPage } from '@types';
import type { ListQuery } from '@/services/api';
import { useListParams } from './useListParams';
import { ADMIN_GOLD, ADMIN_INK } from '../util';

export interface ListColumn<T> {
	key: string;
	label: string;
	/** The server's sort key; columns without one are not sortable. */
	sort?: string;
	align?: 'right';
	className?: string;
	render: (row: T) => ReactNode;
}

export type ListFilter =
	| { key: string; label: string; type: 'select'; options: { value: string; label: string }[] }
	/** Writes `${key}From` and `${key}To` as calendar days. */
	| { key: string; label: string; type: 'dateRange' }
	| { key: string; label: string; type: 'text'; placeholder?: string };

export interface BulkAction {
	key: string;
	label: string;
	tone?: 'primary' | 'danger';
	/** Resolves true when it changed something: the selection clears and the page reloads. */
	run: (ids: string[]) => Promise<boolean>;
}

interface DataListProps<T extends { id: string }> {
	columns: ListColumn<T>[];
	load: (query: ListQuery) => Promise<ListPage<T>>;
	defaultSort: { sort: string; dir: 'asc' | 'desc' };
	searchLabel: string;
	searchPlaceholder?: string;
	filters?: ListFilter[];
	bulkActions?: BulkAction[];
	exportCsv?: (query: ListQuery) => Promise<void>;
	/** Opens the detail panel; the row is highlighted while open. */
	onOpen?: (row: T) => void;
	activeId?: string | null;
	/** Bump to reload the current page, e.g. after the panel saved something. */
	reloadToken?: number;
	rowLabel: (row: T) => string;
	empty: string;
	/** Each loaded page, e.g. to find the row a shared link opens. */
	onLoad?: (rows: T[]) => void;
}

/**
 * The administration's one list: server-side paging (50 a page), sorting,
 * filters as chips, a search box, row selection with bulk actions and a CSV
 * export of the filtered result. Its whole state is in the address, so the
 * detail panel can open and close without the list losing its place.
 */
export default function DataList<T extends { id: string }>({
	columns, load, defaultSort, searchLabel, searchPlaceholder, filters = [], bulkActions = [],
	exportCsv, onOpen, activeId, reloadToken = 0, rowLabel, empty, onLoad,
}: DataListProps<T>) {
	const { t, i18n } = useTranslation();
	const { query, update } = useListParams();
	const [data, setData] = useState<ListPage<T> | null>(null);
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [busy, setBusy] = useState<string | null>(null);
	const [search, setSearch] = useState(query.q ?? '');
	const [bulkReload, setBulkReload] = useState(0);
	const latest = useRef(0);

	const queryKey = JSON.stringify(query);
	const sort = query.sort ?? defaultSort.sort;
	const dir = (query.dir as 'asc' | 'desc' | undefined) ?? defaultSort.dir;

	useEffect(() => {
		const ticket = ++latest.current;
		setLoading(true);
		setFailed(false);
		load(JSON.parse(queryKey) as ListQuery)
			.then((page) => {
				if (ticket !== latest.current) return;
				setData(page);
				setSelected(new Set());
				onLoad?.(page.rows);
			})
			.catch((error) => {
				console.error(error);
				if (ticket === latest.current) setFailed(true);
			})
			.finally(() => {
				if (ticket === latest.current) setLoading(false);
			});
		// `load` is recreated by the page on every render; the query is what matters.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [queryKey, reloadToken, bulkReload]);

	// The box follows the address (back button), and typing writes it after a pause.
	useEffect(() => setSearch(query.q ?? ''), [query.q]);
	useEffect(() => {
		if (search.trim() === (query.q ?? '')) return;
		const timer = setTimeout(() => update({ q: search.trim() || null }), 300);
		return () => clearTimeout(timer);
	}, [search, query.q, update]);

	const rows = data?.rows ?? [];
	const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
	const number = (value: number) => value.toLocaleString(i18n.language);

	const toggleSort = (column: ListColumn<T>) => {
		if (!column.sort) return;
		const nextDir = sort === column.sort ? (dir === 'asc' ? 'desc' : 'asc') : 'asc';
		update({ sort: column.sort, dir: nextDir });
	};

	const toggleRow = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const runBulk = async (action: BulkAction) => {
		setBusy(action.key);
		try {
			if (await action.run([...selected])) setBulkReload((n) => n + 1);
		} finally {
			setBusy(null);
		}
	};

	const runExport = async () => {
		if (!exportCsv) return;
		setBusy('export');
		try {
			await exportCsv(query);
		} catch (error) {
			console.error(error);
			toast.error(t('adminShell.list.exportError'));
		} finally {
			setBusy(null);
		}
	};

	const activeFilters = filters.filter((filter) =>
		filter.type === 'dateRange' ? query[`${filter.key}From`] || query[`${filter.key}To`] : query[filter.key]);
	const idleFilters = filters.filter((filter) => !activeFilters.includes(filter));

	const page = data?.page ?? 1;
	const pageSize = data?.pageSize ?? 50;
	const pages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
	const from = data && data.total > 0 ? (page - 1) * pageSize + 1 : 0;
	const to = data ? Math.min(page * pageSize, (page - 1) * pageSize + rows.length) : 0;
	const goTo = (target: number) => update({ page: target > 1 ? String(target) : null });

	return (
		<div className="flex min-w-0 flex-col gap-3">
			<div className="flex flex-wrap items-end gap-2">
				<label className="flex min-w-0 flex-[1_1_280px] flex-col gap-1 text-xs font-bold text-muted-foreground">
					{searchLabel}
					<span className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3">
						<Search className="size-4 shrink-0" aria-hidden />
						<input
							type="search"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={searchPlaceholder}
							className="w-full bg-transparent text-sm font-normal text-foreground outline-none placeholder:text-muted-foreground"
						/>
					</span>
				</label>
				{exportCsv && (
					<button
						type="button"
						onClick={runExport}
						disabled={busy === 'export'}
						className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-bold disabled:opacity-60"
					>
						{busy === 'export' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
						{t('adminShell.list.export')}
					</button>
				)}
			</div>

			{filters.length > 0 && (
				<div className="flex flex-wrap items-center gap-2">
					{activeFilters.map((filter) => (
						<FilterChip key={filter.key} filter={filter} query={query} update={update} active />
					))}
					{idleFilters.length > 0 && <AddFilter filters={idleFilters} query={query} update={update} />}
					<span className="ml-auto hidden text-xs text-muted-foreground md:inline">{t('adminShell.list.filtersInUrl')}</span>
				</div>
			)}

			{selected.size > 0 && bulkActions.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#0F172A] px-3.5 py-2.5 text-white" role="region" aria-label={t('adminShell.list.bulkActions')}>
					<span className="text-sm font-bold">{t('adminShell.list.selected', { count: selected.size })}</span>
					{bulkActions.map((action) => (
						<button
							key={action.key}
							type="button"
							disabled={busy !== null}
							onClick={() => runBulk(action)}
							className={cn(
								'flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-bold disabled:opacity-60',
								action.tone === 'danger' ? 'bg-[#DC2626] text-white' : 'border border-[#475569] text-white'
							)}
							style={action.tone === 'primary' ? { backgroundColor: ADMIN_GOLD, color: ADMIN_INK, border: 'none' } : undefined}
						>
							{busy === action.key && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
							{action.label}
						</button>
					))}
					<button type="button" onClick={() => setSelected(new Set())} className="h-9 px-2 text-[13px] font-semibold text-[#CBD5E1]">
						{t('adminShell.list.clearSelection')}
					</button>
				</div>
			)}

			<div className="relative overflow-x-auto rounded-xl border border-border bg-card">
				<table className="w-full min-w-[760px] border-collapse text-[13.5px]">
					<thead>
						<tr className="bg-muted text-left">
							{bulkActions.length > 0 && (
								<th scope="col" className="w-10 px-3 py-2.5">
									<input
										type="checkbox"
										checked={allSelected}
										onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)))}
										aria-label={t('adminShell.list.selectAll')}
										className="size-4 align-middle"
									/>
								</th>
							)}
							{columns.map((column) => {
								const sorted = column.sort && sort === column.sort;
								return (
									<th
										key={column.key}
										scope="col"
										aria-sort={sorted ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
										className={cn('px-3 py-2.5 text-xs font-bold text-muted-foreground', column.align === 'right' && 'text-right')}
									>
										{column.sort ? (
											<button
												type="button"
												onClick={() => toggleSort(column)}
												className={cn('inline-flex items-center gap-1 text-xs font-bold', sorted && 'text-foreground')}
											>
												{column.label}
												{sorted && (dir === 'asc' ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />)}
											</button>
										) : column.label}
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => {
							const isActive = activeId === row.id;
							return (
								<tr
									key={row.id}
									onClick={onOpen ? () => onOpen(row) : undefined}
									className={cn(
										'border-t border-border',
										onOpen && 'cursor-pointer hover:bg-muted',
										isActive && 'bg-[#FFFBEB] hover:bg-[#FFFBEB]'
									)}
								>
									{bulkActions.length > 0 && (
										<td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
											<input
												type="checkbox"
												checked={selected.has(row.id)}
												onChange={() => toggleRow(row.id)}
												aria-label={t('adminShell.list.selectRow', { name: rowLabel(row) })}
												className="size-4 align-middle"
											/>
										</td>
									)}
									{columns.map((column, index) => (
										<td key={column.key} className={cn('px-3 py-2', column.align === 'right' && 'text-right tabular-nums', column.className)}>
											{index === 0 && onOpen ? (
												// The row is clickable; this button is what a keyboard reaches.
												<button
													type="button"
													onClick={(event) => { event.stopPropagation(); onOpen(row); }}
													aria-expanded={isActive}
													className="text-left"
												>
													{column.render(row)}
												</button>
											) : column.render(row)}
										</td>
									))}
								</tr>
							);
						})}
					</tbody>
				</table>

				{!loading && !failed && rows.length === 0 && (
					<p className="px-4 py-10 text-center text-sm text-muted-foreground">{empty}</p>
				)}
				{failed && (
					<p className="px-4 py-10 text-center text-sm text-destructive">{t('adminShell.list.loadError')}</p>
				)}
				{loading && (
					<div className={cn('flex items-center justify-center', rows.length ? 'absolute inset-0 bg-card/60' : 'py-10')}>
						<Loader2 className="size-5 animate-spin text-muted-foreground" aria-label={t('common.loading')} />
					</div>
				)}
			</div>

			{data && data.total > 0 && (
				<nav className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted-foreground" aria-label={t('adminShell.list.pages')}>
					<span>
						{t(data.estimated ? 'adminShell.list.rangeEstimated' : 'adminShell.list.range', {
							from: number(from), to: number(to), total: number(data.total),
						})}
						{' · '}
						{t('adminShell.list.perPage', { count: pageSize })}
					</span>
					<div className="flex flex-wrap gap-1.5">
						<PageButton disabled={page <= 1} onClick={() => goTo(page - 1)}>{t('adminShell.list.previous')}</PageButton>
						{pageNumbers(page, pages).map((target, index) =>
							target === null ? (
								<span key={`gap-${index}`} className="flex h-9 items-center px-1">…</span>
							) : (
								<PageButton key={target} current={target === page} onClick={() => goTo(target)}>
									{number(target)}
								</PageButton>
							)
						)}
						<PageButton disabled={page >= pages} onClick={() => goTo(page + 1)}>{t('adminShell.list.next')}</PageButton>
					</div>
				</nav>
			)}
		</div>
	);
}

/** First, last, and the pages either side of the current one. */
function pageNumbers(page: number, pages: number): (number | null)[] {
	const wanted = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
	return wanted.flatMap((n, index) => (index > 0 && n - wanted[index - 1] > 1 ? [null, n] : [n]));
}

function PageButton({ current, disabled, onClick, children }: {
	current?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-current={current ? 'page' : undefined}
			className={cn(
				'h-9 min-w-11 rounded-lg border px-2.5 text-[13px] disabled:opacity-50',
				current ? 'border-[#0F172A] bg-[#0F172A] font-bold text-white' : 'border-border bg-card text-foreground'
			)}
		>
			{children}
		</button>
	);
}

interface FilterProps {
	query: ListQuery;
	update: (changes: Record<string, string | null>) => void;
}

function useChipText(filter: ListFilter, query: ListQuery): string {
	const { t, i18n } = useTranslation();
	const day = (value?: string) =>
		value ? new Date(`${value}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'numeric', year: 'numeric' }) : '…';
	switch (filter.type) {
		case 'select':
			return `${filter.label}: ${filter.options.find((option) => option.value === query[filter.key])?.label ?? query[filter.key]}`;
		case 'dateRange':
			return `${filter.label}: ${day(query[`${filter.key}From`])} – ${day(query[`${filter.key}To`])}`;
		case 'text':
			return `${filter.label}: ${query[filter.key] ?? t('adminShell.list.any')}`;
	}
}

function clearKeys(filter: ListFilter): Record<string, null> {
	return filter.type === 'dateRange' ? { [`${filter.key}From`]: null, [`${filter.key}To`]: null } : { [filter.key]: null };
}

function FilterChip({ filter, query, update, active }: FilterProps & { filter: ListFilter; active: boolean }) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const text = useChipText(filter, query);
	return (
		<span className="flex h-9 items-center rounded-full border border-[#38BDF8] bg-[#E0F2FE] text-[13px] font-semibold text-[#0F172A]">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button type="button" className="h-full pl-3 pr-1.5">{text}</button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-72 p-3">
					<FilterEditor filter={filter} query={query} update={update} onDone={() => setOpen(false)} />
				</PopoverContent>
			</Popover>
			{active && (
				<button
					type="button"
					onClick={() => update(clearKeys(filter))}
					aria-label={t('adminShell.list.removeFilter', { label: filter.label })}
					className="flex h-full items-center pl-0.5 pr-2.5"
				>
					<X className="size-3.5" aria-hidden />
				</button>
			)}
		</span>
	);
}

function AddFilter({ filters, query, update }: FilterProps & { filters: ListFilter[] }) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const [picked, setPicked] = useState<ListFilter | null>(null);
	return (
		<Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setPicked(null); }}>
			<PopoverTrigger asChild>
				<button type="button" className="flex h-9 items-center gap-1 rounded-full border border-dashed border-[#94A3B8] px-3 text-[13px] font-semibold text-[#334155]">
					<Plus className="size-3.5" aria-hidden />
					{t('adminShell.list.addFilter')}
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72 p-3">
				{picked ? (
					<FilterEditor filter={picked} query={query} update={update} onDone={() => { setOpen(false); setPicked(null); }} />
				) : (
					<div className="flex flex-col">
						{filters.map((filter) => (
							<button key={filter.key} type="button" onClick={() => setPicked(filter)} className="rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted">
								{filter.label}
							</button>
						))}
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}

function FilterEditor({ filter, query, update, onDone }: FilterProps & { filter: ListFilter; onDone: () => void }) {
	const { t } = useTranslation();
	const [from, setFrom] = useState(query[`${filter.key}From`] ?? '');
	const [to, setTo] = useState(query[`${filter.key}To`] ?? '');
	const [value, setValue] = useState(query[filter.key] ?? '');

	const apply = (changes: Record<string, string | null>) => {
		update(changes);
		onDone();
	};

	return (
		<div className="flex flex-col gap-2.5">
			<span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{filter.label}</span>
			{filter.type === 'select' && (
				<div className="flex flex-col" role="listbox" aria-label={filter.label}>
					{filter.options.map((option) => (
						<button
							key={option.value}
							type="button"
							role="option"
							aria-selected={query[filter.key] === option.value}
							onClick={() => apply({ [filter.key]: option.value })}
							className={cn('rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted', query[filter.key] === option.value && 'font-bold')}
						>
							{option.label}
						</button>
					))}
				</div>
			)}
			{filter.type === 'dateRange' && (
				<form
					className="flex flex-col gap-2"
					onSubmit={(event) => { event.preventDefault(); apply({ [`${filter.key}From`]: from || null, [`${filter.key}To`]: to || null }); }}
				>
					<label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
						{t('adminShell.list.from')}
						<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground" />
					</label>
					<label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
						{t('adminShell.list.to')}
						<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground" />
					</label>
					<ApplyButton />
				</form>
			)}
			{filter.type === 'text' && (
				<form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); apply({ [filter.key]: value.trim() || null }); }}>
					<input
						value={value}
						onChange={(event) => setValue(event.target.value)}
						placeholder={filter.placeholder}
						aria-label={filter.label}
						autoFocus
						className="h-10 rounded-lg border border-border bg-card px-2.5 text-sm"
					/>
					<ApplyButton />
				</form>
			)}
		</div>
	);
}

function ApplyButton() {
	const { t } = useTranslation();
	return (
		<button type="submit" className="h-10 rounded-lg text-sm font-bold" style={{ backgroundColor: ADMIN_GOLD, color: ADMIN_INK }}>
			{t('adminShell.list.apply')}
		</button>
	);
}
