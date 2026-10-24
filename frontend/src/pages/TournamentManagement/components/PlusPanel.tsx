import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { ArrowDown, ArrowUp, Download, FileText, Lock, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@components/base/button';
import LogoUpload from '@components/LogoUpload';
import { tournamentApi } from '@/services/api';
import type { TournamentPlus, TournamentSponsor } from '@types';

interface PlusPanelProps {
	tournamentId: string;
	/** Opens the plan offer, as hitting the team limit does. */
	onUpgrade: () => void;
}

const inp = 'w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary';

const sizeOf = (bytes: number): string =>
	bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`;

/** The message for an error the server sent with a code; a generic one otherwise. */
const errorKey = (err: unknown): string => {
	const code = isAxiosError<{ code?: string; feature?: string }>(err) ? err.response?.data?.code : undefined;
	const feature = isAxiosError<{ feature?: string }>(err) ? err.response?.data?.feature : undefined;
	if (code === 'PLAN_FEATURE') return feature === 'DOCUMENT_SIZE' ? 'plus.errors.documentSize' : 'plus.errors.limit';
	if (code === 'NOT_PDF') return 'plus.errors.notPdf';
	if (code === 'FILE_TOO_LARGE') return 'plus.errors.documentSize';
	if (code === 'INVALID_SPONSOR') return 'plus.errors.sponsor';
	return 'plus.errors.save';
};

/**
 * Partners and documents of a tournament: what Turnaj Plus and Organizátor
 * add. On a plan without them the section says what they bring and offers the
 * upgrade; what was added under a plan that has since ended stays listed.
 */
export default function PlusPanel({ tournamentId, onUpgrade }: PlusPanelProps) {
	const { t } = useTranslation();
	const [plus, setPlus] = useState<TournamentPlus | null>(null);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);

	const [sponsorForm, setSponsorForm] = useState<{ id: string | null; name: string; url: string; logo: string | null } | null>(null);
	const [logoBusy, setLogoBusy] = useState(false);
	const [docTitle, setDocTitle] = useState('');
	const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);

	const load = () => tournamentApi.getPlus(tournamentId).then((res) => setPlus(res.data)).catch(() => setError(t('plus.errors.load')));
	useEffect(() => { void load(); }, [tournamentId]);

	const run = async (action: () => Promise<unknown>) => {
		setBusy(true);
		setError('');
		try {
			await action();
			await load();
		} catch (err) {
			setError(t(errorKey(err)));
		} finally {
			setBusy(false);
		}
	};

	if (!plus) return <div className="py-8 text-center text-sm text-muted-foreground">{error || t('tm.common.loading')}</div>;

	const sponsors = plus.sponsors.items;
	const documents = plus.documents.items;
	const canAddSponsor = plus.sponsors.used < plus.sponsors.limit;
	const canAddDocument = plus.documents.used < plus.documents.limit;
	const locked = plus.sponsors.limit === 0 && plus.documents.limit === 0;

	const saveSponsor = () => sponsorForm && sponsorForm.logo && run(async () => {
		const data = { name: sponsorForm.name.trim(), url: sponsorForm.url.trim() || undefined, logo: sponsorForm.logo! };
		if (sponsorForm.id) await tournamentApi.updateSponsor(tournamentId, sponsorForm.id, { ...data, url: data.url ?? null });
		else await tournamentApi.addSponsor(tournamentId, data);
		setSponsorForm(null);
	});

	const move = (index: number, direction: -1 | 1) => run(async () => {
		const ids = sponsors.map((s) => s.id);
		[ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
		await tournamentApi.orderSponsors(tournamentId, ids);
	});

	const upload = (file: File) => run(async () => {
		await tournamentApi.uploadDocument(tournamentId, file, docTitle.trim() || undefined);
		setDocTitle('');
		if (fileInput.current) fileInput.current.value = '';
	});

	const edit = (sponsor: TournamentSponsor) => setSponsorForm({ id: sponsor.id, name: sponsor.name, url: sponsor.url ?? '', logo: sponsor.logo });

	return (
		<div className="flex max-w-3xl flex-col gap-5">
			{locked ? (
				<div className="flex flex-col gap-3 rounded-xl border-2 border-violet-300 bg-violet-50 p-4 sm:flex-row sm:items-center">
					<Lock className="size-5 shrink-0 text-violet-700" aria-hidden />
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						<span className="text-[15px] font-semibold">{t('plus.locked.title')}</span>
						<span className="text-[13px] text-muted-foreground">{t('plus.locked.body')}</span>
					</div>
					<Button size="sm" className="shrink-0 bg-violet-700 hover:bg-violet-800" onClick={onUpgrade}>{t('plus.locked.action')}</Button>
				</div>
			) : (
				<p className="text-sm text-muted-foreground">
					{plus.branding === 'LIGHT' ? t('plus.brandingLight') : t('plus.brandingFull')}
				</p>
			)}

			{error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

			{/* Partners */}
			<section className="flex flex-col gap-3 rounded-lg border p-4">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h3 className="text-base font-semibold">{t('plus.sponsors.title')}</h3>
					<span className="text-xs text-muted-foreground">{t('plus.used', { used: plus.sponsors.used, limit: plus.sponsors.limit })}</span>
				</div>
				<p className="text-[13px] text-muted-foreground">{t('plus.sponsors.hint')}</p>
				{sponsors.length > 0 && (
					<ul className="divide-y rounded border">
						{sponsors.map((sponsor, index) => (
							<li key={sponsor.id} className="flex items-center gap-3 px-3 py-2">
								<img src={sponsor.logo} alt="" className="h-9 w-16 shrink-0 object-contain" />
								<span className="flex min-w-0 flex-1 flex-col">
									<span className="truncate text-sm font-medium">{sponsor.name}</span>
									{sponsor.url && <span className="truncate text-xs text-muted-foreground">{sponsor.url}</span>}
								</span>
								<Button variant="ghost" size="sm" aria-label={t('plus.moveUp')} disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp className="size-4" /></Button>
								<Button variant="ghost" size="sm" aria-label={t('plus.moveDown')} disabled={busy || index === sponsors.length - 1} onClick={() => move(index, 1)}><ArrowDown className="size-4" /></Button>
								<Button variant="ghost" size="sm" aria-label={t('plus.edit')} disabled={busy} onClick={() => edit(sponsor)}><Pencil className="size-4" /></Button>
								<Button variant="ghost" size="sm" aria-label={t('plus.remove')} className="text-red-500" disabled={busy}
									onClick={() => confirm(t('plus.sponsors.removeConfirm', { name: sponsor.name })) && run(() => tournamentApi.deleteSponsor(tournamentId, sponsor.id))}>
									<Trash2 className="size-4" />
								</Button>
							</li>
						))}
					</ul>
				)}
				{sponsorForm ? (
					<div className="flex flex-col gap-3 rounded border bg-muted/30 p-3">
						<LogoUpload value={sponsorForm.logo} onChange={(logo) => setSponsorForm((f) => f && { ...f, logo })} name={sponsorForm.name || '?'} onBusyChange={setLogoBusy} />
						<label className="flex flex-col gap-1 text-sm">
							<span className="font-medium">{t('plus.sponsors.name')}</span>
							<input className={inp} value={sponsorForm.name} maxLength={100} onChange={(e) => setSponsorForm((f) => f && { ...f, name: e.target.value })} />
						</label>
						<label className="flex flex-col gap-1 text-sm">
							<span className="font-medium">{t('plus.sponsors.url')}</span>
							<input className={inp} type="url" inputMode="url" placeholder="https://" value={sponsorForm.url} onChange={(e) => setSponsorForm((f) => f && { ...f, url: e.target.value })} />
						</label>
						<div className="flex justify-end gap-2">
							<Button variant="outline" size="sm" onClick={() => setSponsorForm(null)}>{t('tm.common.cancel')}</Button>
							<Button size="sm" disabled={busy || logoBusy || !sponsorForm.name.trim() || !sponsorForm.logo} onClick={saveSponsor}>{t('tm.common.save')}</Button>
						</div>
						{!sponsorForm.logo && <span className="text-xs text-muted-foreground">{t('plus.sponsors.logoNeeded')}</span>}
					</div>
				) : (
					<Button variant="outline" size="sm" className="self-start gap-1" disabled={!canAddSponsor || busy}
						onClick={() => setSponsorForm({ id: null, name: '', url: '', logo: null })}>
						<Plus className="size-4" /> {t('plus.sponsors.add')}
					</Button>
				)}
			</section>

			{/* Documents */}
			<section className="flex flex-col gap-3 rounded-lg border p-4">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h3 className="text-base font-semibold">{t('plus.documents.title')}</h3>
					<span className="text-xs text-muted-foreground">{t('plus.used', { used: plus.documents.used, limit: plus.documents.limit })}</span>
				</div>
				<p className="text-[13px] text-muted-foreground">{t('plus.documents.hint', { mb: plus.documents.maxMb || 10 })}</p>
				{documents.length > 0 && (
					<ul className="divide-y rounded border">
						{documents.map((doc) => (
							<li key={doc.id} className="flex items-center gap-3 px-3 py-2">
								<FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
								{renaming?.id === doc.id ? (
									<form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); void run(async () => { await tournamentApi.renameDocument(tournamentId, doc.id, renaming.title); setRenaming(null); }); }}>
										<input className={inp} value={renaming.title} maxLength={120} aria-label={t('plus.documents.titleLabel')} onChange={(e) => setRenaming({ id: doc.id, title: e.target.value })} />
										<Button type="submit" size="sm" disabled={busy || !renaming.title.trim()}>{t('tm.common.save')}</Button>
										<Button type="button" variant="ghost" size="sm" aria-label={t('tm.common.cancel')} onClick={() => setRenaming(null)}><X className="size-4" /></Button>
									</form>
								) : (
									<>
										<span className="flex min-w-0 flex-1 flex-col">
											<span className="truncate text-sm font-medium">{doc.title}</span>
											<span className="text-xs text-muted-foreground">PDF · {sizeOf(doc.size)}</span>
										</span>
										<a href={tournamentApi.documentUrl(tournamentId, doc.id)} target="_blank" rel="noopener" aria-label={t('plus.documents.download')}
											className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted">
											<Download className="size-4" />
										</a>
										<Button variant="ghost" size="sm" aria-label={t('plus.edit')} disabled={busy} onClick={() => setRenaming({ id: doc.id, title: doc.title })}><Pencil className="size-4" /></Button>
										<Button variant="ghost" size="sm" aria-label={t('plus.remove')} className="text-red-500" disabled={busy}
											onClick={() => confirm(t('plus.documents.removeConfirm', { title: doc.title })) && run(() => tournamentApi.deleteDocument(tournamentId, doc.id))}>
											<Trash2 className="size-4" />
										</Button>
									</>
								)}
							</li>
						))}
					</ul>
				)}
				{canAddDocument && (
					<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
						<label className="flex flex-1 flex-col gap-1 text-sm">
							<span className="font-medium">{t('plus.documents.titleLabel')}</span>
							<input className={inp} value={docTitle} maxLength={120} placeholder={t('plus.documents.titlePlaceholder')} onChange={(e) => setDocTitle(e.target.value)} />
						</label>
						<input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden"
							onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
						<Button variant="outline" size="sm" className="gap-1" disabled={busy} onClick={() => fileInput.current?.click()}>
							<Upload className="size-4" /> {t('plus.documents.upload')}
						</Button>
					</div>
				)}
			</section>
		</div>
	);
}
