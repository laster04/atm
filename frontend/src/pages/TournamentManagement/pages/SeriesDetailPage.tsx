import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tournamentSeriesApi, tournamentApi } from '@/services/api';
import type { TournamentSeries, Tournament, TournamentStatus } from '@types';
import { Button } from '@components/base/button';
import { Badge } from '@components/base/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@components/base/dialog';
import { Plus, Pencil, ChevronRight, Trophy } from 'lucide-react';

const STATUS_OPTIONS: TournamentStatus[] = ['DRAFT', 'REGISTRATION', 'GROUP_STAGE', 'PLAYOFF', 'COMPLETED'];
const STATUS_VARIANT: Record<TournamentStatus, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'outline', REGISTRATION: 'secondary', GROUP_STAGE: 'default', PLAYOFF: 'default', COMPLETED: 'secondary',
};

const EMPTY_T = { name: '', year: '', location: '', startDate: '', endDate: '', status: 'DRAFT' as TournamentStatus };

export default function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [series, setSeries] = useState<TournamentSeries | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingT, setEditingT] = useState<Tournament | null>(null);
  const [form, setForm] = useState(EMPTY_T);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      tournamentSeriesApi.getById(id),
      tournamentApi.getBySeries(id),
    ]).then(([sRes, tRes]) => {
      setSeries(sRes.data);
      setTournaments(tRes.data);
    }).catch(() => setError(t('tm.seriesDetail.errors.load'))).finally(() => setLoading(false));
  }, [id]);

  const openCreate = () => {
    setEditingT(null);
    setForm(EMPTY_T);
    setModalOpen(true);
  };

  const openEdit = (t: Tournament) => {
    setEditingT(t);
    setForm({
      name: t.name,
      year: t.year?.toString() ?? '',
      location: t.location ?? '',
      startDate: t.startDate ? t.startDate.slice(0, 10) : '',
      endDate: t.endDate ? t.endDate.slice(0, 10) : '',
      status: t.status,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !id) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        year: form.year ? parseInt(form.year) : undefined,
        location: form.location || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        status: form.status,
      };
      if (editingT) {
        const res = await tournamentApi.update(editingT.id, payload);
        setTournaments(prev => prev.map(t => t.id === editingT.id ? res.data : t));
      } else {
        const res = await tournamentApi.create(id, payload);
        setTournaments(prev => [...prev, res.data]);
      }
      setModalOpen(false);
    } catch {
      setError(t('tm.seriesDetail.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center text-muted-foreground py-8">{t('tm.common.loading')}</div>;
  if (!series) return <div className="text-center text-red-500 py-8">{t('tm.seriesDetail.notFound')}</div>;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/tournament-management/series" className="hover:text-foreground">{t('tm.common.series')}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{series.name}</span>
      </div>

      {/* Series header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Trophy className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{series.name}</h2>
            <Badge variant="outline" className="text-xs">{series.sportType}</Badge>
          </div>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1">
          <Plus className="size-4" /> {t('tm.seriesDetail.newEdition')}
        </Button>
      </div>

      {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 text-sm">{error}</div>}

      {/* Tournament editions list */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('tm.seriesDetail.editions')}</h3>
        {tournaments.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border rounded-lg">
            {t('tm.seriesDetail.empty')}
          </div>
        ) : (
          <div className="divide-y border rounded-lg">
            {tournaments.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                <Link to={`/tournament-management/tournament/${t.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    {t.year && <span className="text-muted-foreground text-sm">{t.year}</span>}
                    <Badge variant={STATUS_VARIANT[t.status] ?? 'outline'} className="text-xs">
                      {t.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  {t.location && <div className="text-xs text-muted-foreground mt-0.5">{t.location}</div>}
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Pencil className="size-4" /></Button>
                  <Link to={`/tournament-management/tournament/${t.id}`}>
                    <Button variant="ghost" size="sm"><ChevronRight className="size-4" /></Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingT ? t('tm.seriesDetail.modal.editTitle') : t('tm.seriesDetail.modal.createTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium">{t('tm.fields.name')} *</label>
              <input className="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. City Hockey Cup 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t('tm.fields.year')}</label>
                <input type="number" className="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  placeholder="2026" />
              </div>
              <div>
                <label className="text-sm font-medium">{t('tm.fields.status')}</label>
                <select className="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TournamentStatus }))}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{t(`tm.tournamentStatus.${s}`, s)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t('tm.fields.location')}</label>
              <input className="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder={t('tm.seriesDetail.form.locationPlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t('tm.fields.startDate')}</label>
                <input type="date" className="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">{t('tm.fields.endDate')}</label>
                <input type="date" className="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>{t('tm.common.cancel')}</Button>
              <Button onClick={handleSave} disabled={saving || !form.name}>
                {saving ? t('tm.common.saving') : t('tm.common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
