import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tournamentSeriesApi } from '@/services/api';
import type { TournamentSeries} from '@types';
import { SportType } from '@types';
import { Button } from '@components/base/button';
import { Badge } from '@components/base/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@components/base/dialog';
import { Plus, Pencil, Trash2, Trophy, ChevronRight } from 'lucide-react';

const EMPTY: Partial<TournamentSeries> = { name: '', sportType: SportType.HOCKEY, description: '', logo: '' };

export default function SeriesListPage() {
  const { t } = useTranslation();
  const [series, setSeries] = useState<TournamentSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TournamentSeries | null>(null);
  const [form, setForm] = useState<Partial<TournamentSeries>>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    tournamentSeriesApi.getAll()
      .then(r => setSeries(r.data))
      .catch(() => setError(t('tm.series.errors.load')))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (s: TournamentSeries) => { setEditing(s); setForm({ name: s.name, sportType: s.sportType, description: s.description ?? '', logo: s.logo ?? '' }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const res = await tournamentSeriesApi.update(editing.id, form);
        setSeries(prev => prev.map(s => s.id === editing.id ? res.data : s));
      } else {
        const res = await tournamentSeriesApi.create(form);
        setSeries(prev => [...prev, res.data]);
      }
      setModalOpen(false);
    } catch {
      setError(t('tm.series.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('tm.series.deleteConfirm'))) return;
    try {
      await tournamentSeriesApi.delete(id);
      setSeries(prev => prev.filter(s => s.id !== id));
    } catch {
      setError(t('tm.series.errors.delete'));
    }
  };

  if (loading) return <div className="text-center text-muted-foreground py-8">{t('tm.common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('tm.series.title')}</h2>
        <Button onClick={openCreate} size="sm" className="gap-1">
          <Plus className="size-4" /> {t('tm.series.newButton')}
        </Button>
      </div>

      {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 text-sm">{error}</div>}

      {series.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Trophy className="size-10 mx-auto mb-3 opacity-40" />
          <p>{t('tm.series.empty')}</p>
        </div>
      ) : (
        <div className="divide-y border rounded-lg">
          {series.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Trophy className="size-4 text-primary" />
              </div>
              <Link to={`/tournament-management/series/${s.id}`} className="flex-1 min-w-0">
                <div className="font-medium">{s.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">{s.sportType}</Badge>
                  <span className="text-xs text-muted-foreground">{s._count?.tournaments ?? 0} {t('tm.common.editions')}</span>
                </div>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-700"><Trash2 className="size-4" /></Button>
                <Link to={`/tournament-management/series/${s.id}`}><Button variant="ghost" size="sm"><ChevronRight className="size-4" /></Button></Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('tm.series.modal.editTitle') : t('tm.series.modal.createTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium">{t('tm.fields.name')} *</label>
              <input
                className="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.name ?? ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('tm.series.form.namePlaceholder')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('tm.fields.sportType')}</label>
              <select
                className="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                value={form.sportType ?? 'HOCKEY'}
                onChange={e => setForm(f => ({ ...f, sportType: e.target.value as TournamentSeries['sportType'] }))}
              >
                <option value="HOCKEY">{t('tm.series.form.sportType.HOCKEY')}</option>
                <option value="TENNIS">{t('tm.series.form.sportType.TENNIS')}</option>
                <option value="OTHER">{t('tm.series.form.sportType.OTHER')}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">{t('tm.fields.description')}</label>
              <textarea
                className="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                rows={2}
                value={form.description ?? ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('tm.fields.logoUrl')}</label>
              <input
                className="w-full mt-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.logo ?? ''}
                onChange={e => setForm(f => ({ ...f, logo: e.target.value }))}
                placeholder="https://..."
              />
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
